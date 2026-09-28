"""
Modular storage layer.  Currently uses local filesystem.
Replace implementations here to switch to MongoDB or another store.
"""
import os
import json
import uuid
import shutil
from pathlib import Path
from app.config import STORAGE_DIR


def _project_dir(project_id: str) -> Path:
    p = Path(STORAGE_DIR) / project_id
    p.mkdir(parents=True, exist_ok=True)
    return p


def create_project(filename: str) -> dict:
    project_id = str(uuid.uuid4())
    d = _project_dir(project_id)
    meta = {
        "project_id": project_id,
        "original_filename": filename,
        "status": "uploaded",
        "training_status": "not_started",
    }
    _save_meta(project_id, meta)
    return meta


def save_raw_csv(project_id: str, content: bytes) -> Path:
    p = _project_dir(project_id) / "raw.csv"
    p.write_bytes(content)
    return p


def get_raw_csv_path(project_id: str) -> Path:
    return _project_dir(project_id) / "raw.csv"


def save_clean_csv(project_id: str, df_bytes: bytes) -> Path:
    p = _project_dir(project_id) / "clean.csv"
    p.write_bytes(df_bytes)
    return p


def get_clean_csv_path(project_id: str) -> Path:
    return _project_dir(project_id) / "clean.csv"


def save_validation(project_id: str, report: dict) -> None:
    _save_json(project_id, "validation.json", report)


def get_validation(project_id: str) -> dict | None:
    return _load_json(project_id, "validation.json")


def save_model_meta(project_id: str, meta: dict) -> None:
    _save_json(project_id, "model_meta.json", meta)


def get_model_meta(project_id: str) -> dict | None:
    return _load_json(project_id, "model_meta.json")


def get_pipeline_path(project_id: str) -> Path:
    return _project_dir(project_id) / "pipeline.joblib"


def save_evaluation(project_id: str, report: dict) -> None:
    _save_json(project_id, "evaluation.json", report)


def get_evaluation(project_id: str) -> dict | None:
    return _load_json(project_id, "evaluation.json")


def save_insights(project_id: str, report: dict) -> None:
    _save_json(project_id, "insights.json", report)


def get_insights(project_id: str) -> dict | None:
    return _load_json(project_id, "insights.json")


def _save_meta(project_id: str, meta: dict) -> None:
    _save_json(project_id, "meta.json", meta)


def get_meta(project_id: str) -> dict | None:
    return _load_json(project_id, "meta.json")


def update_meta(project_id: str, updates: dict) -> None:
    meta = get_meta(project_id) or {}
    meta.update(updates)
    _save_meta(project_id, meta)


def _save_json(project_id: str, filename: str, data: dict) -> None:
    p = _project_dir(project_id) / filename
    p.write_text(json.dumps(data, default=str), encoding="utf-8")


def _load_json(project_id: str, filename: str) -> dict | None:
    p = _project_dir(project_id) / filename
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return None


def project_exists(project_id: str) -> bool:
    return (_project_dir(project_id) / "meta.json").exists()
