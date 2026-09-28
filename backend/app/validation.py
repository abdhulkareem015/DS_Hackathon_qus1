"""
CSV validation, cleaning, and preprocessing utilities.
"""
import io
import re
import pandas as pd
import numpy as np
from app.config import (
    REQUIRED_COLUMNS, NUMERIC_FEATURES, CATEGORICAL_FEATURES,
    TARGET_COL, BATCH_COL, TARGET_MAPPINGS
)


def resolve_target(series: pd.Series):
    """
    Map raw target values to 0/1 integers.
    Returns (mapped_series, mapping_info) or raises ValueError.
    """
    unique_raw = set(series.dropna().astype(str).str.strip().unique())

    # Try numeric 0/1 first
    numeric_attempt = pd.to_numeric(series, errors="coerce")
    if not numeric_attempt.isna().all():
        valid = numeric_attempt.dropna()
        unique_vals = set(valid.unique())
        if unique_vals <= {0.0, 1.0}:
            return numeric_attempt.dropna().astype(int), {"type": "numeric_binary", "0": "Non-Defective", "1": "Defective"}

    # Try string mappings
    normalized = series.astype(str).str.strip()
    for defective_set, non_defective_set in TARGET_MAPPINGS:
        def_strs = {str(v) for v in defective_set}
        non_def_strs = {str(v) for v in non_defective_set}
        all_known = def_strs | non_def_strs
        matched = unique_raw & all_known
        if len(matched) >= 1 and unique_raw <= all_known:
            mapped = normalized.map(
                {v: 1 for v in def_strs} | {v: 0 for v in non_def_strs}
            )
            return mapped.dropna().astype(int), {
                "type": "string_mapping",
                "defective_values": list(def_strs & unique_raw),
                "non_defective_values": list(non_def_strs & unique_raw),
            }

    ambiguous = unique_raw - {"nan", ""}
    raise ValueError(
        f"Ambiguous or unsupported target values: {sorted(ambiguous)[:10]}. "
        "Supported: 0/1, Yes/No, True/False, Defective/Non-defective."
    )


def validate_and_clean(df_raw: pd.DataFrame, remove_duplicates: bool = False) -> dict:
    """
    Full validation pipeline. Returns a dict with:
      - df_clean: cleaned DataFrame (target mapped to 0/1)
      - report: validation report dict
    """
    report = {}
    original_rows = len(df_raw)
    report["original_rows"] = original_rows

    # 1. Trim column names
    df_raw.columns = [c.strip() for c in df_raw.columns]

    # 2. Check required columns
    missing_cols = [c for c in REQUIRED_COLUMNS if c not in df_raw.columns]
    if missing_cols:
        raise ValueError(f"Missing required columns: {missing_cols}")

    df = df_raw.copy()

    # 3. Trim categorical string values
    for col in [BATCH_COL, "Machine_ID", "Raw_Material_Batch", "Operator_Shift"]:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()

    # 4. Exact duplicate rows
    dup_mask = df.duplicated()
    dup_count = int(dup_mask.sum())
    report["duplicate_rows"] = dup_count

    if remove_duplicates and dup_count > 0:
        df = df[~dup_mask].reset_index(drop=True)
        report["duplicates_removed"] = dup_count
    else:
        report["duplicates_removed"] = 0

    # 5. Missing values per column
    missing_by_col = {}
    for col in df.columns:
        n_miss = int(df[col].isna().sum())
        # also count empty strings for categorical
        if df[col].dtype == object:
            n_miss += int((df[col].astype(str).str.strip() == "").sum())
        if n_miss:
            missing_by_col[col] = n_miss
    report["missing_by_column"] = missing_by_col

    # 6. Numeric conversion errors
    invalid_numeric = {}
    for col in NUMERIC_FEATURES:
        before = df[col].notna().sum()
        converted = pd.to_numeric(df[col], errors="coerce")
        after = converted.notna().sum()
        n_invalid = int(before - after)
        if n_invalid:
            invalid_numeric[col] = n_invalid
        df[col] = converted
    report["invalid_numeric_by_column"] = invalid_numeric

    # 7. Resolve target column
    target_series = df[TARGET_COL].copy()
    try:
        mapped_target, mapping_info = resolve_target(target_series)
    except ValueError as e:
        raise ValueError(str(e))

    report["target_mapping"] = mapping_info
    n_invalid_target = int(len(df) - len(mapped_target))
    report["invalid_target_rows"] = n_invalid_target

    # Align index
    df = df.loc[mapped_target.index].copy()
    df[TARGET_COL] = mapped_target.values

    # 8. Single-class check
    class_counts = df[TARGET_COL].value_counts().to_dict()
    report["class_distribution"] = {str(k): int(v) for k, v in class_counts.items()}
    if len(class_counts) < 2:
        report["single_class_warning"] = (
            "Only one class present in target. Supervised training is not possible."
        )

    # 9. Outlier detection (IQR-based, flagging only)
    outlier_info = {}
    for col in NUMERIC_FEATURES:
        s = df[col].dropna()
        if len(s) < 4:
            continue
        q1, q3 = s.quantile(0.25), s.quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            continue
        lo, hi = q1 - 3 * iqr, q3 + 3 * iqr
        n_out = int(((s < lo) | (s > hi)).sum())
        if n_out:
            outlier_info[col] = {
                "count": n_out,
                "lower_fence": round(float(lo), 4),
                "upper_fence": round(float(hi), 4),
            }
    report["outliers_flagged"] = outlier_info

    # 10. Summary
    report["usable_labeled_rows"] = len(df)
    report["defect_rate"] = round(
        float(df[TARGET_COL].mean()), 6
    ) if len(df) else 0.0

    # Numeric descriptive stats
    numeric_stats = {}
    for col in NUMERIC_FEATURES:
        s = df[col].dropna()
        if len(s):
            numeric_stats[col] = {
                "count": int(s.count()),
                "mean": round(float(s.mean()), 4),
                "std": round(float(s.std()), 4),
                "min": round(float(s.min()), 4),
                "p25": round(float(s.quantile(0.25)), 4),
                "median": round(float(s.median()), 4),
                "p75": round(float(s.quantile(0.75)), 4),
                "max": round(float(s.max()), 4),
                "missing": int(df[col].isna().sum()),
            }
    report["numeric_stats"] = numeric_stats

    report["applied_cleaning"] = [
        "Trimmed column names and categorical whitespace",
        f"Converted numeric columns (errors→NaN): {list(NUMERIC_FEATURES)}",
        f"Mapped target column using: {mapping_info.get('type','unknown')}",
    ]
    if remove_duplicates and dup_count:
        report["applied_cleaning"].append(f"Removed {dup_count} exact duplicate rows")

    return {"df_clean": df, "report": report}


def get_preview(df: pd.DataFrame, n: int = 20) -> dict:
    preview_df = df.head(n).copy()
    # Replace NaN/inf with None for JSON compliance
    for col in preview_df.columns:
        if preview_df[col].dtype in ['float64', 'float32']:
            preview_df[col] = preview_df[col].apply(
                lambda x: None if (x is None or (isinstance(x, float) and (x != x or x == float('inf') or x == float('-inf')))) else x
            )
    preview_df = preview_df.where(pd.notna(preview_df), None)
    # Convert to records safely
    rows = []
    for rec in preview_df.to_dict(orient="records"):
        clean_rec = {}
        for k, v in rec.items():
            if isinstance(v, float) and (v != v or v == float('inf') or v == float('-inf')):
                clean_rec[k] = None
            else:
                clean_rec[k] = v
        rows.append(clean_rec)
    return {
        "columns": list(preview_df.columns),
        "rows": rows,
        "total_rows": len(df),
        "total_columns": len(df.columns),
    }
