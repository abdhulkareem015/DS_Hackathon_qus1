"""
Deterministic evidence-based insight generation.
"""
import math
import numpy as np
import pandas as pd
from app.config import NUMERIC_FEATURES, TARGET_COL, BATCH_COL
from app.analysis import defect_rate_by, _wilson_ci, _safe_rate


def generate_insights(df: pd.DataFrame, eval_report: dict | None = None) -> dict:
    """Generate 5–7 evidence-based insights from computed statistics."""
    insights = []
    n_total = len(df)
    n_def = int(df[TARGET_COL].sum())
    overall_rate = _safe_rate(n_def, n_total)

    # ── Insight 1: Overall defect prevalence ──────────────────────────────────
    ci_lo, ci_hi = _wilson_ci(n_total, n_def)
    insights.append({
        "id": 1,
        "title": "Overall Defect Prevalence",
        "text": (
            f"Out of {n_total:,} inspected records, {n_def:,} are defective "
            f"({overall_rate*100:.2f}%, Wilson 95% CI: "
            f"{ci_lo*100:.1f}%–{ci_hi*100:.1f}%). "
            "This baseline rate is the reference for all comparisons below."
        ),
        "supporting_numbers": {
            "inspected": n_total,
            "defective": n_def,
            "overall_defect_rate": overall_rate,
            "ci_lower": ci_lo,
            "ci_upper": ci_hi,
        },
        "category": "prevalence",
    })

    # ── Insight 2: Machine-level variation ────────────────────────────────────
    machine_rates = defect_rate_by(df, "Machine_ID")
    if len(machine_rates) >= 2:
        worst = machine_rates[0]
        best = machine_rates[-1]
        if worst["defect_rate"] > overall_rate * 1.2 and worst["inspected"] >= 20:
            insights.append({
                "id": 2,
                "title": "Machine-Level Defect Rate Variation",
                "text": (
                    f"Machine {worst['Machine_ID']} has the highest defect rate: "
                    f"{worst['defect_rate']*100:.1f}% "
                    f"({worst['defective']}/{worst['inspected']} records), "
                    f"which is {(worst['defect_rate']/overall_rate):.2f}× the overall rate. "
                    f"Machine {best['Machine_ID']} has the lowest: "
                    f"{best['defect_rate']*100:.1f}% ({best['defective']}/{best['inspected']}). "
                    "This variation warrants investigation of maintenance history and calibration."
                ),
                "supporting_numbers": {
                    "highest_machine": worst["Machine_ID"],
                    "highest_rate": worst["defect_rate"],
                    "lowest_machine": best["Machine_ID"],
                    "lowest_rate": best["defect_rate"],
                    "overall_rate": overall_rate,
                },
                "category": "machine",
            })

    # ── Insight 3: Raw-material batch variation ───────────────────────────────
    rm_rates = defect_rate_by(df, "Raw_Material_Batch")
    high_rm = [r for r in rm_rates if r["defect_rate"] > overall_rate * 1.5 and r["inspected"] >= 20]
    if high_rm:
        worst_rm = high_rm[0]
        insights.append({
            "id": 3,
            "title": "Raw-Material Batch Investigation Candidates",
            "text": (
                f"{len(high_rm)} raw-material batch(es) show defect rates ≥1.5× the overall rate. "
                f"Batch {worst_rm['Raw_Material_Batch']} is highest at "
                f"{worst_rm['defect_rate']*100:.1f}% "
                f"({worst_rm['defective']}/{worst_rm['inspected']}). "
                "These batches are candidates for supplier quality review, though process "
                "interactions should be ruled out before attributing causality to the material."
            ),
            "supporting_numbers": {
                "elevated_batches": len(high_rm),
                "worst_batch": worst_rm["Raw_Material_Batch"],
                "worst_rate": worst_rm["defect_rate"],
                "overall_rate": overall_rate,
            },
            "category": "raw_material",
        })

    # ── Insight 4: Operator shift variation ───────────────────────────────────
    shift_rates = defect_rate_by(df, "Operator_Shift")
    if len(shift_rates) >= 2:
        worst_shift = shift_rates[0]
        best_shift = shift_rates[-1]
        rate_diff = worst_shift["defect_rate"] - best_shift["defect_rate"]
        if rate_diff > 0.02 and worst_shift["inspected"] >= 20 and best_shift["inspected"] >= 20:
            insights.append({
                "id": 4,
                "title": "Operator Shift Defect Rate Difference",
                "text": (
                    f"The '{worst_shift['Operator_Shift']}' shift has a defect rate of "
                    f"{worst_shift['defect_rate']*100:.1f}% "
                    f"({worst_shift['defective']}/{worst_shift['inspected']}), "
                    f"compared with {best_shift['defect_rate']*100:.1f}% "
                    f"for the '{best_shift['Operator_Shift']}' shift "
                    f"({best_shift['defective']}/{best_shift['inspected']}). "
                    f"The gap is {rate_diff*100:.1f} percentage points. "
                    "Possible investigation areas include fatigue, training, or handover procedures."
                ),
                "supporting_numbers": {
                    "worst_shift": worst_shift["Operator_Shift"],
                    "worst_rate": worst_shift["defect_rate"],
                    "best_shift": best_shift["Operator_Shift"],
                    "best_rate": best_shift["defect_rate"],
                    "gap_pct_points": round(rate_diff * 100, 2),
                },
                "category": "shift",
            })

    # ── Insight 5: Numeric condition differences ──────────────────────────────
    numeric_insights = []
    for col in NUMERIC_FEATURES:
        s0 = df.loc[df[TARGET_COL] == 0, col].dropna()
        s1 = df.loc[df[TARGET_COL] == 1, col].dropna()
        if len(s0) < 10 or len(s1) < 10:
            continue
        mean_diff = s1.mean() - s0.mean()
        pooled_std = math.sqrt((s0.std() ** 2 + s1.std() ** 2) / 2)
        cohen_d = abs(mean_diff / pooled_std) if pooled_std > 0 else 0
        numeric_insights.append((col, mean_diff, cohen_d, s0, s1))

    if numeric_insights:
        numeric_insights.sort(key=lambda x: x[2], reverse=True)
        col, mean_diff, cohen_d, s0, s1 = numeric_insights[0]
        direction = "higher" if mean_diff > 0 else "lower"
        insights.append({
            "id": 5,
            "title": f"{col} Differs Between Defective and Non-Defective Records",
            "text": (
                f"Defective records have a mean {col} of {s1.mean():.2f} "
                f"(n={len(s1):,}), compared with {s0.mean():.2f} "
                f"(n={len(s0):,}) for non-defective records. "
                f"Mean is {abs(mean_diff):.2f} units {direction} in defective records "
                f"(Cohen's d≈{cohen_d:.2f}). "
                "This is an association to investigate, not a confirmed causal factor. "
                "Controlled process trials are needed to establish causality."
            ),
            "supporting_numbers": {
                "feature": col,
                "mean_defective": round(float(s1.mean()), 4),
                "mean_non_defective": round(float(s0.mean()), 4),
                "mean_diff": round(float(mean_diff), 4),
                "cohen_d": round(cohen_d, 4),
            },
            "category": "numeric_condition",
        })

    # ── Insight 6: Model top predictors (if evaluation available) ─────────────
    if eval_report and "permutation_importance" in eval_report:
        imp = eval_report["permutation_importance"]
        valid_imp = [x for x in imp if "importance_mean" in x and x["importance_mean"] > 0]
        if valid_imp:
            top = valid_imp[:3]
            top_names = ", ".join(x["feature"] for x in top)
            insights.append({
                "id": 6,
                "title": "Model's Most Predictive Features",
                "text": (
                    f"Held-out permutation importance ranks {top_names} as the top predictive features. "
                    f"Top feature '{top[0]['feature']}' has a mean F1 importance of "
                    f"{top[0]['importance_mean']:.4f} (±{top[0]['importance_std']:.4f}). "
                    "Note: predictive importance reflects statistical association in this dataset. "
                    "It does not establish causation and may reflect correlations with unmeasured factors."
                ),
                "supporting_numbers": {x["feature"]: x["importance_mean"] for x in top},
                "category": "model",
            })

    # ── Insight 7: High-risk machine × shift combo ────────────────────────────
    combo_rows = []
    for (m, s), sub in df.groupby(["Machine_ID", "Operator_Shift"], sort=False):
        n = len(sub)
        k = int(sub[TARGET_COL].sum())
        if n >= 20:
            rate = _safe_rate(k, n)
            combo_rows.append((m, s, n, k, rate))
    combo_rows.sort(key=lambda x: x[4], reverse=True)

    if combo_rows:
        m, s, n, k, rate = combo_rows[0]
        if rate > overall_rate * 1.3:
            insights.append({
                "id": 7,
                "title": "Highest-Risk Machine × Shift Combination",
                "text": (
                    f"Machine {m} during the '{s}' shift has the highest combined defect rate: "
                    f"{rate*100:.1f}% ({k}/{n} records), "
                    f"which is {(rate/overall_rate):.2f}× the overall rate. "
                    "This combination is a priority investigation target. "
                    "Consider cross-referencing maintenance logs and shift briefings for this machine."
                ),
                "supporting_numbers": {
                    "machine": m,
                    "shift": s,
                    "inspected": n,
                    "defective": k,
                    "defect_rate": rate,
                    "lift": round(rate / overall_rate, 4) if overall_rate > 0 else None,
                },
                "category": "combination",
            })

    if len(insights) < 5:
        insights.append({
            "id": len(insights) + 1,
            "title": "Insufficient Data for Additional Insights",
            "text": (
                f"Only {len(insights)} reliable insights could be generated from this dataset. "
                "A larger dataset with more defective records and greater variation across "
                "machines, shifts, and material batches would enable more specific findings."
            ),
            "supporting_numbers": {"n_total": n_total, "n_defective": n_def},
            "category": "data_quality",
        })

    # ── Action plan ───────────────────────────────────────────────────────────
    action_plan = _build_action_plan(insights, overall_rate)

    return {"insights": insights, "action_plan": action_plan, "overall_defect_rate": overall_rate}


def _build_action_plan(insights: list, overall_rate: float) -> list:
    plan = []
    for ins in insights:
        cat = ins.get("category", "")
        sn = ins.get("supporting_numbers", {})

        if cat == "machine":
            plan.append({
                "finding": f"Machine {sn.get('highest_machine')} defect rate ({sn.get('highest_rate',0)*100:.1f}%) is elevated",
                "recommendation": (
                    "Inspect maintenance records, calibration logs, and tooling condition for this machine. "
                    "Compare operating parameters with lower-defect machines. Run a controlled trial after maintenance."
                ),
                "responsible_role": "Maintenance Engineer / Process Engineer",
                "priority": "High",
                "metric_to_monitor": "Defect rate per 100 inspected records on this machine",
                "validation_method": "Statistical comparison of defect rates before and after intervention (min 200 records each period)",
            })
        elif cat == "raw_material":
            plan.append({
                "finding": f"Raw-material batch {sn.get('worst_batch')} shows elevated defect rate ({sn.get('worst_rate',0)*100:.1f}%)",
                "recommendation": (
                    "Trace the material lot through the supply chain. Review supplier quality certificates. "
                    "Segregate suspect material and retest. Do not assume causality without ruling out process interactions."
                ),
                "responsible_role": "Quality Engineer / Procurement",
                "priority": "High",
                "metric_to_monitor": "Defect rate per material lot",
                "validation_method": "Side-by-side production trial using suspect vs. known-good material batches",
            })
        elif cat == "shift":
            plan.append({
                "finding": f"'{sn.get('worst_shift')}' shift defect rate ({sn.get('worst_rate',0)*100:.1f}%) exceeds '{sn.get('best_shift')}' shift by {sn.get('gap_pct_points',0):.1f} pp",
                "recommendation": (
                    "Review shift handover procedures, operator training records, and fatigue policies. "
                    "Standardise setup and inspection checklists across all shifts."
                ),
                "responsible_role": "Production Supervisor / HR / Training",
                "priority": "Medium",
                "metric_to_monitor": "Defect rate by shift per week",
                "validation_method": "Monitor trends over 4 weeks after procedural changes",
            })
        elif cat == "numeric_condition":
            feat = sn.get("feature", "unknown")
            plan.append({
                "finding": f"{feat} differs between defective and non-defective records (Cohen's d={sn.get('cohen_d',0):.2f})",
                "recommendation": (
                    f"Investigate whether {feat} excursions precede defects. "
                    "Plot {feat} trends over time per machine. "
                    "Do not set fixed thresholds without engineering specifications and controlled trials."
                ),
                "responsible_role": "Process Engineer",
                "priority": "Medium",
                "metric_to_monitor": f"Distribution of {feat} per machine per shift",
                "validation_method": "Design of experiment (DOE) with controlled variation in {feat}",
            })
        elif cat == "combination":
            plan.append({
                "finding": f"Machine {sn.get('machine')} × {sn.get('shift')} shift has lift {sn.get('lift',1):.2f}×",
                "recommendation": (
                    "Prioritise this machine–shift combination for targeted observation. "
                    "Compare operator-specific practices and machine condition during this shift. "
                    "Check whether scheduled maintenance falls near this shift."
                ),
                "responsible_role": "Production Supervisor / Maintenance",
                "priority": "High",
                "metric_to_monitor": "Defect rate for this machine–shift pairing",
                "validation_method": "Dedicated monitoring period with increased inspection frequency",
            })
        elif cat == "model":
            plan.append({
                "finding": "Random Forest identifies key predictive features",
                "recommendation": (
                    "Use the model as a soft screening tool to flag batches with elevated predicted risk. "
                    "Do not reduce physical inspection based solely on model output. "
                    "Retrain the model as more data accumulates and after process changes."
                ),
                "responsible_role": "Data Analyst / Quality Team",
                "priority": "Low",
                "metric_to_monitor": "Model recall on new production data",
                "validation_method": "Monthly review of model predictions vs. actual defects",
            })

    if not plan:
        plan.append({
            "finding": "Insufficient variation detected for specific recommendations",
            "recommendation": "Collect more data across machines, shifts, and material batches to enable targeted analysis.",
            "responsible_role": "Quality Manager",
            "priority": "Medium",
            "metric_to_monitor": "Overall defect rate",
            "validation_method": "Track defect rate monthly",
        })

    return plan
