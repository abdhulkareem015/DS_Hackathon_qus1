"""
Electronics Manufacturing Defect Analyzer — FastAPI Backend
"""
import io
import json
import threading
import traceback
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional

from app.config import CORS_ORIGINS, MAX_UPLOAD_BYTES, REQUIRED_COLUMNS
import app.storage as storage
from app.validation import validate_and_clean, get_preview
from app.analysis import (
    summary_stats, defect_rate_by, numeric_stats_by_defect,
    machine_defect_chart, raw_material_defect_chart,
    scatter_data, heatmap_data, high_risk_combinations,
    apply_filters, get_filter_options
)
from app.ml import train_model, predict_single
from app.insights import generate_insights

import math

def _nan_safe(obj):
    """Recursively replace NaN/Inf floats with None for JSON compliance."""
    if isinstance(obj, dict):
        return {k: _nan_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_nan_safe(v) for v in obj]
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    return obj

app = FastAPI(
    title="Electronics Manufacturing Defect Analyzer",
    version="1.0.0",
    description="Upload production data, explore defect patterns, train a classifier.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Training state (in-process; replace with celery/redis for production) ───
_training_lock = threading.Lock()
_training_status: dict[str, dict] = {}


def _require_project(project_id: str):
    if not storage.project_exists(project_id):
        raise HTTPException(404, f"Project '{project_id}' not found.")


def _require_clean_data(project_id: str) -> pd.DataFrame:
    _require_project(project_id)
    p = storage.get_clean_csv_path(project_id)
    if not p.exists():
        raise HTTPException(400, "No cleaned dataset found. Please upload and validate first.")
    return pd.read_csv(p)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Upload & Validation
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/projects/upload")
async def upload_csv(file: UploadFile = File(...)):
    """Create a new project by uploading a CSV file."""
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Only CSV files are accepted.")

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"File exceeds {MAX_UPLOAD_BYTES // 1024 // 1024} MB limit.")
    if len(content) == 0:
        raise HTTPException(400, "Uploaded file is empty.")

    # Sanitise filename
    safe_name = Path(file.filename).name
    if not safe_name:
        safe_name = "upload.csv"

    # Try reading CSV
    try:
        df_raw = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Could not parse CSV: {e}")

    if len(df_raw) == 0:
        raise HTTPException(400, "CSV file contains no rows.")

    # Validate
    try:
        result = validate_and_clean(df_raw, remove_duplicates=False)
    except ValueError as e:
        raise HTTPException(422, str(e))

    df_clean = result["df_clean"]
    report = result["report"]

    # Create project and persist
    meta = storage.create_project(safe_name)
    pid = meta["project_id"]
    storage.save_raw_csv(pid, content)
    storage.save_clean_csv(pid, df_clean.to_csv(index=False).encode())
    storage.save_validation(pid, report)
    storage.update_meta(pid, {"status": "validated", "rows": len(df_clean)})

    preview = get_preview(df_clean)

    return {
        "project_id": pid,
        "filename": safe_name,
        "validation_report": report,
        "preview": preview,
    }


@app.get("/projects/{project_id}/validation")
async def get_validation(project_id: str):
    _require_project(project_id)
    report = storage.get_validation(project_id)
    if not report:
        raise HTTPException(404, "Validation report not found.")
    return report


@app.get("/projects/{project_id}/preview")
async def get_preview_endpoint(project_id: str, n: int = 20):
    df = _require_clean_data(project_id)
    return get_preview(df, n=n)


@app.post("/projects/{project_id}/clean")
async def apply_cleaning(project_id: str, request: Request):
    """Apply cleaning options (e.g., remove_duplicates=true)."""
    _require_project(project_id)
    body = await request.json()
    remove_dups = bool(body.get("remove_duplicates", False))

    raw_path = storage.get_raw_csv_path(project_id)
    if not raw_path.exists():
        raise HTTPException(404, "Raw CSV not found.")

    df_raw = pd.read_csv(raw_path)
    try:
        result = validate_and_clean(df_raw, remove_duplicates=remove_dups)
    except ValueError as e:
        raise HTTPException(422, str(e))

    df_clean = result["df_clean"]
    report = result["report"]
    storage.save_clean_csv(project_id, df_clean.to_csv(index=False).encode())
    storage.save_validation(project_id, report)
    storage.update_meta(project_id, {"rows": len(df_clean)})

    return {"validation_report": report, "preview": get_preview(df_clean)}


# ─────────────────────────────────────────────────────────────────────────────
# 2. Analysis
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/projects/{project_id}/filter-options")
async def filter_options(project_id: str):
    df = _require_clean_data(project_id)
    return get_filter_options(df)


@app.get("/projects/{project_id}/summary")
async def get_summary(
    project_id: str,
    machine_id: Optional[str] = None,
    batch_id: Optional[str] = None,
    raw_material_batch: Optional[str] = None,
    operator_shift: Optional[str] = None,
):
    df = _require_clean_data(project_id)
    filters = {
        "machine_id": machine_id,
        "batch_id": batch_id,
        "raw_material_batch": raw_material_batch,
        "operator_shift": operator_shift,
    }
    df = apply_filters(df, filters)
    if len(df) == 0:
        raise HTTPException(400, "No records match the selected filters.")
    return summary_stats(df)


@app.get("/projects/{project_id}/defect-rates")
async def get_defect_rates(
    project_id: str,
    machine_id: Optional[str] = None,
    batch_id: Optional[str] = None,
    raw_material_batch: Optional[str] = None,
    operator_shift: Optional[str] = None,
):
    df = _require_clean_data(project_id)
    filters = {
        "machine_id": machine_id,
        "batch_id": batch_id,
        "raw_material_batch": raw_material_batch,
        "operator_shift": operator_shift,
    }
    df = apply_filters(df, filters)
    if len(df) == 0:
        raise HTTPException(400, "No records match the selected filters.")

    return {
        "by_machine": defect_rate_by(df, "Machine_ID"),
        "by_batch": defect_rate_by(df, "Batch_ID"),
        "by_raw_material": defect_rate_by(df, "Raw_Material_Batch"),
        "by_shift": defect_rate_by(df, "Operator_Shift"),
        "numeric_stats_by_defect": numeric_stats_by_defect(df),
        "overall_rate": float(df["Defect_Status"].mean()),
        "filter_note": "Analysis filters apply to all tables below. Model training always uses the full validated dataset.",
    }


@app.get("/projects/{project_id}/charts/machine-defect")
async def chart_machine_defect(
    project_id: str,
    machine_id: Optional[str] = None,
    batch_id: Optional[str] = None,
    raw_material_batch: Optional[str] = None,
    operator_shift: Optional[str] = None,
):
    df = _require_clean_data(project_id)
    filters = {"machine_id": machine_id, "batch_id": batch_id,
               "raw_material_batch": raw_material_batch, "operator_shift": operator_shift}
    df = apply_filters(df, filters)
    return {"data": machine_defect_chart(df), "overall_rate": float(df["Defect_Status"].mean())}


@app.get("/projects/{project_id}/charts/raw-material-defect")
async def chart_rm_defect(
    project_id: str,
    machine_id: Optional[str] = None,
    batch_id: Optional[str] = None,
    raw_material_batch: Optional[str] = None,
    operator_shift: Optional[str] = None,
):
    df = _require_clean_data(project_id)
    filters = {"machine_id": machine_id, "batch_id": batch_id,
               "raw_material_batch": raw_material_batch, "operator_shift": operator_shift}
    df = apply_filters(df, filters)
    return {"data": raw_material_defect_chart(df), "overall_rate": float(df["Defect_Status"].mean())}


@app.get("/projects/{project_id}/charts/scatter")
async def chart_scatter(
    project_id: str,
    x_col: str = "Temperature",
    y_col: str = "Pressure",
    machine_id: Optional[str] = None,
    batch_id: Optional[str] = None,
    raw_material_batch: Optional[str] = None,
    operator_shift: Optional[str] = None,
):
    df = _require_clean_data(project_id)
    filters = {"machine_id": machine_id, "batch_id": batch_id,
               "raw_material_batch": raw_material_batch, "operator_shift": operator_shift}
    df = apply_filters(df, filters)
    try:
        return scatter_data(df, x_col, y_col)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/projects/{project_id}/charts/heatmap")
async def chart_heatmap(
    project_id: str,
    machine_id: Optional[str] = None,
    batch_id: Optional[str] = None,
    raw_material_batch: Optional[str] = None,
    operator_shift: Optional[str] = None,
):
    df = _require_clean_data(project_id)
    filters = {"machine_id": machine_id, "batch_id": batch_id,
               "raw_material_batch": raw_material_batch, "operator_shift": operator_shift}
    df = apply_filters(df, filters)
    return heatmap_data(df)


@app.get("/projects/{project_id}/high-risk")
async def get_high_risk(
    project_id: str,
    min_support: int = 20,
    machine_id: Optional[str] = None,
    batch_id: Optional[str] = None,
    raw_material_batch: Optional[str] = None,
    operator_shift: Optional[str] = None,
):
    df = _require_clean_data(project_id)
    filters = {"machine_id": machine_id, "batch_id": batch_id,
               "raw_material_batch": raw_material_batch, "operator_shift": operator_shift}
    df = apply_filters(df, filters)
    return high_risk_combinations(df, min_support=min_support)


# ─────────────────────────────────────────────────────────────────────────────
# 3. Model Training
# ─────────────────────────────────────────────────────────────────────────────

def _run_training(project_id: str):
    with _training_lock:
        _training_status[project_id] = {"status": "running", "message": "Training in progress..."}
    try:
        df = pd.read_csv(storage.get_clean_csv_path(project_id))
        pipeline_path = storage.get_pipeline_path(project_id)
        report = train_model(df, pipeline_path)

        if "error" in report:
            with _training_lock:
                _training_status[project_id] = {
                    "status": "failed",
                    "message": report["error"],
                }
            storage.update_meta(project_id, {"training_status": "failed"})
            return

        storage.save_evaluation(project_id, report)
        storage.update_meta(project_id, {"training_status": "completed"})

        # Also generate insights with model info
        try:
            insights = generate_insights(df, eval_report=report)
            storage.save_insights(project_id, insights)
        except Exception as e:
            pass  # insights are optional

        with _training_lock:
            _training_status[project_id] = {
                "status": "completed",
                "message": "Training completed successfully.",
            }
    except Exception as e:
        tb = traceback.format_exc()
        with _training_lock:
            _training_status[project_id] = {
                "status": "failed",
                "message": f"Unexpected error: {str(e)}",
                "traceback": tb,
            }
        storage.update_meta(project_id, {"training_status": "failed"})


@app.post("/projects/{project_id}/train")
async def start_training(project_id: str, background_tasks: BackgroundTasks):
    _require_clean_data(project_id)
    with _training_lock:
        current = _training_status.get(project_id, {})
    if current.get("status") == "running":
        raise HTTPException(409, "Training is already in progress.")

    storage.update_meta(project_id, {"training_status": "running"})
    background_tasks.add_task(_run_training, project_id)
    return {"message": "Training started.", "project_id": project_id}


@app.get("/projects/{project_id}/train/status")
async def training_status(project_id: str):
    _require_project(project_id)
    with _training_lock:
        status = _training_status.get(project_id, {"status": "not_started", "message": "No training has been started."})
    return status


@app.get("/projects/{project_id}/evaluation")
async def get_evaluation(project_id: str):
    _require_project(project_id)
    ev = storage.get_evaluation(project_id)
    if not ev:
        raise HTTPException(404, "No evaluation report found. Please train a model first.")
    return ev


# ─────────────────────────────────────────────────────────────────────────────
# 4. Prediction
# ─────────────────────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    Machine_ID: str
    Temperature: float
    Pressure: float
    Machine_Speed: float
    Raw_Material_Batch: str
    Operator_Shift: str


@app.post("/projects/{project_id}/predict")
async def predict(project_id: str, body: PredictRequest):
    _require_project(project_id)
    pipeline_path = storage.get_pipeline_path(project_id)
    if not pipeline_path.exists():
        raise HTTPException(400, "No trained model found. Please train a model first.")

    input_data = body.model_dump()
    try:
        result = predict_single(pipeline_path, input_data)
    except FileNotFoundError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Prediction failed: {e}")
    return result


# ─────────────────────────────────────────────────────────────────────────────
# 5. Insights
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/projects/{project_id}/insights")
async def get_insights(project_id: str):
    _require_project(project_id)
    ins = storage.get_insights(project_id)
    if ins:
        return ins
    # Generate without model results if not trained yet
    df = _require_clean_data(project_id)
    ev = storage.get_evaluation(project_id)
    result = generate_insights(df, eval_report=ev)
    storage.save_insights(project_id, result)
    return result


# ─────────────────────────────────────────────────────────────────────────────
# 6. Downloads
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/projects/{project_id}/download/clean-csv")
async def download_clean_csv(project_id: str):
    _require_project(project_id)
    p = storage.get_clean_csv_path(project_id)
    if not p.exists():
        raise HTTPException(404, "Clean CSV not found.")
    return StreamingResponse(
        iter([p.read_bytes()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="clean_{project_id}.csv"'},
    )


@app.get("/projects/{project_id}/download/evaluation-json")
async def download_evaluation_json(project_id: str):
    _require_project(project_id)
    ev = storage.get_evaluation(project_id)
    if not ev:
        raise HTTPException(404, "No evaluation report found.")
    content = json.dumps(ev, indent=2, default=str).encode()
    return StreamingResponse(
        iter([content]),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="evaluation_{project_id}.json"'},
    )


@app.get("/projects/{project_id}/download/html-report")
async def download_html_report(project_id: str):
    _require_project(project_id)
    ev = storage.get_evaluation(project_id)
    ins_data = storage.get_insights(project_id)
    val = storage.get_validation(project_id)
    meta = storage.get_meta(project_id)

    html = _generate_html_report(meta, val, ev, ins_data)
    return StreamingResponse(
        iter([html.encode()]),
        media_type="text/html",
        headers={"Content-Disposition": f'attachment; filename="report_{project_id}.html"'},
    )


def _generate_html_report(meta, val, ev, ins_data) -> str:
    filename = meta.get("original_filename", "dataset") if meta else "dataset"
    rows = val.get("usable_labeled_rows", "N/A") if val else "N/A"
    defect_rate = val.get("defect_rate", 0) if val else 0
    rf_acc = ev["random_forest"]["accuracy"] if ev else "N/A"
    rf_f1 = ev["random_forest"]["f1_defective"] if ev else "N/A"
    rf_recall = ev["random_forest"]["recall_defective"] if ev else "N/A"
    insights_html = ""
    if ins_data and "insights" in ins_data:
        for ins in ins_data["insights"]:
            insights_html += f"<li><b>{ins['title']}</b>: {ins['text']}</li>"
    action_html = ""
    if ins_data and "action_plan" in ins_data:
        for ap in ins_data["action_plan"]:
            action_html += f"""
            <tr>
              <td>{ap.get('finding','')}</td>
              <td>{ap.get('recommendation','')}</td>
              <td>{ap.get('responsible_role','')}</td>
              <td>{ap.get('priority','')}</td>
              <td>{ap.get('metric_to_monitor','')}</td>
              <td>{ap.get('validation_method','')}</td>
            </tr>"""
    imp_html = ""
    if ev and "permutation_importance" in ev:
        for feat in ev["permutation_importance"][:10]:
            imp_html += f"<tr><td>{feat.get('feature','')}</td><td>{feat.get('importance_mean',0):.4f}</td><td>±{feat.get('importance_std',0):.4f}</td></tr>"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Defect Analysis Report — {filename}</title>
<style>
  body {{ font-family: Arial, sans-serif; margin: 40px; color: #1a1a1a; }}
  h1 {{ color: #1e40af; }} h2 {{ color: #1d4ed8; border-bottom: 2px solid #3b82f6; padding-bottom: 4px; }}
  .card {{ background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 12px 20px; margin: 10px 0; border-radius: 4px; }}
  table {{ border-collapse: collapse; width: 100%; margin: 10px 0; }}
  th {{ background: #1e40af; color: white; padding: 8px; text-align: left; }}
  td {{ padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }}
  tr:nth-child(even) {{ background: #f8fafc; }}
  .warning {{ background: #fef3c7; border-left: 4px solid #f59e0b; padding: 10px; margin: 10px 0; }}
  .note {{ background: #ecfdf5; border-left: 4px solid #10b981; padding: 10px; margin: 10px 0; }}
</style>
</head>
<body>
<h1>📊 Electronics Manufacturing Defect Analyzer</h1>
<div class="warning">⚠️ All findings are associations for investigation, not proven root causes. Controlled trials are required to establish causality.</div>
<h2>Dataset Overview</h2>
<div class="card">
  <b>File:</b> {filename} &nbsp;|&nbsp; <b>Usable Records:</b> {rows} &nbsp;|&nbsp; <b>Overall Defect Rate:</b> {defect_rate*100:.2f}%
</div>
<h2>Model Performance (Held-Out Test Set)</h2>
{"<div class='card'>No model trained yet.</div>" if not ev else f"""
<table><tr><th>Metric</th><th>Random Forest</th><th>Dummy Baseline</th></tr>
<tr><td>Accuracy</td><td>{ev['random_forest']['accuracy']}</td><td>{ev['dummy_baseline']['accuracy']}</td></tr>
<tr><td>Precision (Defective)</td><td>{ev['random_forest']['precision_defective']}</td><td>{ev['dummy_baseline']['precision_defective']}</td></tr>
<tr><td>Recall (Defective)</td><td>{ev['random_forest']['recall_defective']}</td><td>{ev['dummy_baseline']['recall_defective']}</td></tr>
<tr><td>F1 (Defective)</td><td>{ev['random_forest']['f1_defective']}</td><td>{ev['dummy_baseline']['f1_defective']}</td></tr>
</table>
<p><b>Split method:</b> {ev.get('split_method','N/A')} &nbsp;|&nbsp; <b>Train:</b> {ev.get('train_samples','?')} records &nbsp;|&nbsp; <b>Test:</b> {ev.get('test_samples','?')} records</p>
"""}
<h2>Permutation Feature Importance</h2>
<table><tr><th>Feature</th><th>Mean F1 Importance</th><th>Std</th></tr>{imp_html}</table>
<div class="note">Permutation importance reflects predictive association in this dataset. It does not establish causation.</div>
<h2>Evidence-Based Insights</h2>
<ul>{insights_html}</ul>
<h2>Action Plan</h2>
<table><tr><th>Finding</th><th>Recommendation</th><th>Role</th><th>Priority</th><th>Metric</th><th>Validation</th></tr>
{action_html}
</table>
<hr>
<p style="color:#64748b;font-size:12px;">Generated by Electronics Manufacturing Defect Analyzer. Patterns in synthetic or observational data must not be treated as factory evidence without engineering validation.</p>
</body></html>"""


@app.get("/health")
async def health():
    return {"status": "ok", "service": "defect-analyzer-backend"}
