"""
Descriptive analysis, defect rate tables, charts, and high-risk combinations.
"""
import math
import numpy as np
import pandas as pd
from app.config import (
    NUMERIC_FEATURES, CATEGORICAL_FEATURES, TARGET_COL, BATCH_COL
)


def _wilson_ci(n: int, k: int, z: float = 1.96) -> tuple[float, float]:
    """Wilson confidence interval for a proportion."""
    if n == 0:
        return 0.0, 0.0
    p = k / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    spread = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return max(0.0, round(centre - spread, 6)), min(1.0, round(centre + spread, 6))


def _safe_rate(k: int, n: int) -> float:
    return round(k / n, 6) if n > 0 else 0.0


def defect_rate_by(df: pd.DataFrame, group_col: str) -> list[dict]:
    """Defect rate table grouped by a single column."""
    overall_rate = df[TARGET_COL].mean() if len(df) else 0.0
    rows = []
    for grp, sub in df.groupby(group_col, sort=False):
        n = len(sub)
        k = int(sub[TARGET_COL].sum())
        rate = _safe_rate(k, n)
        ci_lo, ci_hi = _wilson_ci(n, k)
        rows.append({
            group_col: str(grp),
            "inspected": n,
            "defective": k,
            "defect_rate": rate,
            "ci_lower": ci_lo,
            "ci_upper": ci_hi,
            "diff_from_overall": round(rate - overall_rate, 6),
            "lift": round(rate / overall_rate, 4) if overall_rate > 0 else None,
            "small_sample": n < 20,
        })
    rows.sort(key=lambda r: r["defect_rate"], reverse=True)
    return rows


def summary_stats(df: pd.DataFrame) -> dict:
    """Overall summary statistics."""
    n = len(df)
    k = int(df[TARGET_COL].sum())
    machines = df["Machine_ID"].nunique()
    batches = df[BATCH_COL].nunique()
    rm_batches = df["Raw_Material_Batch"].nunique()
    shifts = df["Operator_Shift"].nunique()
    return {
        "inspected": n,
        "defective": k,
        "non_defective": n - k,
        "defect_rate": _safe_rate(k, n),
        "machines": machines,
        "batches": batches,
        "raw_material_batches": rm_batches,
        "shifts": shifts,
    }


def numeric_stats_by_defect(df: pd.DataFrame) -> dict:
    """Descriptive stats for numeric features split by defect status."""
    result = {}
    for col in NUMERIC_FEATURES:
        s = df[col].dropna()
        by_class = {}
        for cls in [0, 1]:
            sub = df.loc[df[TARGET_COL] == cls, col].dropna()
            if len(sub):
                by_class[str(cls)] = {
                    "count": int(sub.count()),
                    "mean": round(float(sub.mean()), 4),
                    "std": round(float(sub.std()), 4),
                    "min": round(float(sub.min()), 4),
                    "p25": round(float(sub.quantile(0.25)), 4),
                    "median": round(float(sub.median()), 4),
                    "p75": round(float(sub.quantile(0.75)), 4),
                    "max": round(float(sub.max()), 4),
                }
        result[col] = by_class
    return result


def machine_defect_chart(df: pd.DataFrame) -> list[dict]:
    """Bar chart data: defect rate by machine."""
    return defect_rate_by(df, "Machine_ID")


def raw_material_defect_chart(df: pd.DataFrame) -> list[dict]:
    """Bar chart data: defect rate by raw material batch."""
    return defect_rate_by(df, "Raw_Material_Batch")


def scatter_data(df: pd.DataFrame, x_col: str, y_col: str, max_points: int = 2000) -> dict:
    """Scatter plot data for two numeric columns coloured by defect status."""
    valid_cols = NUMERIC_FEATURES
    if x_col not in valid_cols or y_col not in valid_cols:
        raise ValueError(f"x_col and y_col must be one of {valid_cols}")

    sub = df[[x_col, y_col, TARGET_COL]].dropna(subset=[x_col, y_col])
    sampled = False
    if len(sub) > max_points:
        sub = sub.sample(n=max_points, random_state=42)
        sampled = True

    records = []
    for _, row in sub.iterrows():
        records.append({
            x_col: round(float(row[x_col]), 4),
            y_col: round(float(row[y_col]), 4),
            "defect": int(row[TARGET_COL]),
        })

    return {
        "points": records,
        "x_col": x_col,
        "y_col": y_col,
        "total_points": len(sub),
        "sampled": sampled,
        "max_points": max_points,
    }


def _safe_cut(series: pd.Series, bins: int) -> pd.Series:
    """pd.cut that merges duplicate bin edges safely."""
    try:
        return pd.cut(series, bins=bins, duplicates="drop", precision=1)
    except Exception:
        return pd.cut(series, bins=2, duplicates="drop", precision=1)


def heatmap_data(df: pd.DataFrame, temp_bins: int = 4, speed_bins: int = 4) -> dict:
    """Temperature-band × machine-speed-band defect rate heatmap."""
    sub = df[[NUMERIC_FEATURES[0], NUMERIC_FEATURES[2], TARGET_COL]].dropna()
    temp_col, speed_col = NUMERIC_FEATURES[0], NUMERIC_FEATURES[2]

    sub = sub.copy()
    sub["temp_band"] = _safe_cut(sub[temp_col], bins=temp_bins)
    sub["speed_band"] = _safe_cut(sub[speed_col], bins=speed_bins)

    cells = []
    for (tb, sb), grp in sub.groupby(["temp_band", "speed_band"], observed=True):
        n = len(grp)
        k = int(grp[TARGET_COL].sum())
        cells.append({
            "temp_band": str(tb),
            "speed_band": str(sb),
            "inspected": n,
            "defective": k,
            "defect_rate": _safe_rate(k, n),
            "low_sample": n < 20,
        })

    return {"cells": cells, "temp_col": temp_col, "speed_col": speed_col}


def high_risk_combinations(df: pd.DataFrame, min_support: int = 20) -> dict:
    """
    Analyze multi-factor combinations for elevated defect rates.
    """
    overall_rate = df[TARGET_COL].mean() if len(df) else 0.0
    results = {}

    combos = [
        ("Machine_ID", "Operator_Shift"),
        ("Raw_Material_Batch", "Machine_ID"),
    ]

    for cols in combos:
        key = " × ".join(cols)
        rows = []
        for grp_vals, sub in df.groupby(list(cols), sort=False):
            n = len(sub)
            k = int(sub[TARGET_COL].sum())
            rate = _safe_rate(k, n)
            lift = round(rate / overall_rate, 4) if overall_rate > 0 else None
            rows.append({
                **{cols[i]: str(grp_vals[i]) for i in range(len(cols))},
                "inspected": n,
                "defective": k,
                "defect_rate": rate,
                "diff_from_overall": round(rate - overall_rate, 6),
                "lift": lift,
                "below_min_support": n < min_support,
            })
        rows.sort(key=lambda r: r["defect_rate"], reverse=True)
        results[key] = rows

    return {
        "combinations": results,
        "overall_defect_rate": round(overall_rate, 6),
        "min_support": min_support,
    }


def apply_filters(df: pd.DataFrame, filters: dict) -> pd.DataFrame:
    """Apply frontend filter selections to the dataframe."""
    if filters.get("machine_id"):
        df = df[df["Machine_ID"] == filters["machine_id"]]
    if filters.get("batch_id"):
        df = df[df[BATCH_COL] == filters["batch_id"]]
    if filters.get("raw_material_batch"):
        df = df[df["Raw_Material_Batch"] == filters["raw_material_batch"]]
    if filters.get("operator_shift"):
        df = df[df["Operator_Shift"] == filters["operator_shift"]]
    return df


def get_filter_options(df: pd.DataFrame) -> dict:
    """All unique values for each filter dropdown."""
    return {
        "machine_ids": sorted(df["Machine_ID"].dropna().unique().tolist()),
        "batch_ids": sorted(df[BATCH_COL].dropna().unique().tolist()),
        "raw_material_batches": sorted(df["Raw_Material_Batch"].dropna().unique().tolist()),
        "operator_shifts": sorted(df["Operator_Shift"].dropna().unique().tolist()),
    }
