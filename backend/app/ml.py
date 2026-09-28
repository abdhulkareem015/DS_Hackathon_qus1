"""
Machine-learning pipeline: training, evaluation, prediction.
"""
import json
import warnings
import numpy as np
import pandas as pd
import joblib
import sklearn
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.dummy import DummyClassifier
from sklearn.model_selection import (
    train_test_split, GroupShuffleSplit, StratifiedKFold
)
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, confusion_matrix,
    classification_report
)
from sklearn.inspection import permutation_importance
from pathlib import Path

from app.config import (
    NUMERIC_FEATURES, CATEGORICAL_FEATURES, TARGET_COL, BATCH_COL
)


def _build_pipeline(cat_features: list, num_features: list) -> Pipeline:
    num_transformer = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
    ])
    cat_transformer = Pipeline([
        ("imputer", SimpleImputer(strategy="constant", fill_value="__missing__")),
        ("ohe", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])
    preprocessor = ColumnTransformer([
        ("num", num_transformer, num_features),
        ("cat", cat_transformer, cat_features),
    ], remainder="drop")

    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=10,
        min_samples_leaf=5,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    return Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", clf),
    ])


def train_model(df: pd.DataFrame, pipeline_path: Path) -> dict:
    """
    Train a Random Forest pipeline, evaluate on held-out test set,
    save the pipeline, return evaluation report.
    """
    feature_cols = NUMERIC_FEATURES + CATEGORICAL_FEATURES
    X = df[feature_cols].copy()
    y = df[TARGET_COL].copy()
    groups = df[BATCH_COL].copy()

    n_samples = len(df)
    n_batches = groups.nunique()
    n_pos = int(y.sum())
    n_neg = n_samples - n_pos

    split_method = "unknown"
    X_train, X_test, y_train, y_test = None, None, None, None

    # --- Splitting strategy ---
    if n_batches == n_samples:
        # Every row is a unique batch → stratified split
        if n_pos < 2 or n_neg < 2:
            return {
                "error": (
                    f"Insufficient class examples for splitting "
                    f"(pos={n_pos}, neg={n_neg}). Need ≥2 of each class."
                )
            }
        try:
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, stratify=y, random_state=42
            )
            split_method = "stratified_random_split (unique batches)"
        except ValueError as e:
            return {"error": f"Could not stratify split: {e}"}

    elif n_batches >= 5:
        # Use group-aware split to prevent batch leakage
        gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
        try:
            train_idx, test_idx = next(gss.split(X, y, groups=groups))
            X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
            y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
            split_method = "group_shuffle_split (batch-aware, prevents leakage)"
            # Verify both sets have both classes
            if y_train.nunique() < 2 or y_test.nunique() < 2:
                # fallback to stratified
                X_train, X_test, y_train, y_test = train_test_split(
                    X, y, test_size=0.2, stratify=y, random_state=42
                )
                split_method = "stratified_random_split (group split failed class balance)"
        except Exception as e:
            return {"error": f"Group split failed: {e}"}
    else:
        return {
            "error": (
                f"Too few distinct batches ({n_batches}) for meaningful "
                "group-aware train/test splitting. Need ≥5 distinct Batch_IDs."
            )
        }

    # Verify test set has both classes
    if len(y_test.unique()) < 2:
        return {
            "error": (
                "Test set contains only one class after splitting. "
                "Cannot compute meaningful evaluation. "
                f"Split method: {split_method}."
            )
        }

    # --- Build and train pipeline ---
    pipeline = _build_pipeline(CATEGORICAL_FEATURES, NUMERIC_FEATURES)
    pipeline.fit(X_train, y_train)

    # Dummy baseline
    dummy = DummyClassifier(strategy="most_frequent", random_state=42)
    dummy.fit(X_train, y_train)

    # --- Evaluate ---
    def _eval(model, X_ev, y_ev, label: str) -> dict:
        y_pred = model.predict(X_ev)
        res = {
            "label": label,
            "accuracy": round(float(accuracy_score(y_ev, y_pred)), 4),
            "precision_defective": round(float(precision_score(y_ev, y_pred, zero_division=0)), 4),
            "recall_defective": round(float(recall_score(y_ev, y_pred, zero_division=0)), 4),
            "f1_defective": round(float(f1_score(y_ev, y_pred, zero_division=0)), 4),
            "confusion_matrix": confusion_matrix(y_ev, y_pred).tolist(),
            "classification_report": classification_report(
                y_ev, y_pred,
                target_names=["Non-Defective", "Defective"],
                output_dict=True, zero_division=0
            ),
        }
        if hasattr(model, "predict_proba"):
            try:
                proba = model.predict_proba(X_ev)[:, 1]
                res["roc_auc"] = round(float(roc_auc_score(y_ev, proba)), 4)
                res["avg_precision"] = round(float(average_precision_score(y_ev, proba)), 4)
            except Exception:
                pass
        return res

    rf_eval = _eval(pipeline, X_test, y_test, "Random Forest")
    dummy_eval = _eval(dummy, X_test, y_test, "Dummy (most frequent)")

    # --- Permutation importance on test set ---
    imp_table = []
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            perm = permutation_importance(
                pipeline, X_test, y_test,
                n_repeats=10, random_state=42, scoring="f1"
            )
        for i, col in enumerate(feature_cols):
            imp_table.append({
                "feature": col,
                "importance_mean": round(float(perm.importances_mean[i]), 6),
                "importance_std": round(float(perm.importances_std[i]), 6),
            })
        imp_table.sort(key=lambda x: x["importance_mean"], reverse=True)
    except Exception as e:
        imp_table = [{"error": str(e)}]

    # --- Feature schema ---
    feature_schema = {
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "feature_order": feature_cols,
    }

    # --- Training ranges for prediction warnings ---
    training_ranges = {}
    for col in NUMERIC_FEATURES:
        s = X_train[col].dropna()
        training_ranges[col] = {"min": float(s.min()), "max": float(s.max())}
    training_categories = {}
    for col in CATEGORICAL_FEATURES:
        training_categories[col] = sorted(X_train[col].dropna().unique().tolist())

    # --- Save pipeline ---
    save_dict = {
        "pipeline": pipeline,
        "feature_schema": feature_schema,
        "training_ranges": training_ranges,
        "training_categories": training_categories,
        "label_mapping": {"0": "Non-Defective", "1": "Defective"},
        "hyperparameters": {
            "n_estimators": 200,
            "max_depth": 10,
            "min_samples_leaf": 5,
            "class_weight": "balanced",
            "random_state": 42,
        },
        "sklearn_version": sklearn.__version__,
        "numpy_version": np.__version__,
    }
    joblib.dump(save_dict, str(pipeline_path))

    report = {
        "split_method": split_method,
        "train_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
        "train_class_distribution": y_train.value_counts().to_dict(),
        "test_class_distribution": y_test.value_counts().to_dict(),
        "random_forest": rf_eval,
        "dummy_baseline": dummy_eval,
        "permutation_importance": imp_table,
        "feature_schema": feature_schema,
        "training_ranges": training_ranges,
        "training_categories": training_categories,
        "label_mapping": {"0": "Non-Defective", "1": "Defective"},
        "decision_threshold": 0.5,
    }
    return report


def predict_single(pipeline_path: Path, input_data: dict) -> dict:
    """
    Load saved pipeline and predict for a single input record.
    """
    if not pipeline_path.exists():
        raise FileNotFoundError("No trained model found. Please train a model first.")

    save_dict = joblib.load(str(pipeline_path))
    pipeline = save_dict["pipeline"]
    training_ranges = save_dict.get("training_ranges", {})
    training_categories = save_dict.get("training_categories", {})
    feature_schema = save_dict["feature_schema"]
    label_mapping = save_dict.get("label_mapping", {"0": "Non-Defective", "1": "Defective"})

    feature_order = feature_schema["feature_order"]
    warnings_list = []

    # Build input row
    row = {}
    for col in feature_order:
        row[col] = input_data.get(col)

    # Numeric range checks
    for col in NUMERIC_FEATURES:
        val = row.get(col)
        if val is not None:
            try:
                val = float(val)
                row[col] = val
                rng = training_ranges.get(col, {})
                lo, hi = rng.get("min"), rng.get("max")
                if lo is not None and (val < lo or val > hi):
                    warnings_list.append(
                        f"{col}={val} is outside training range [{lo:.2f}, {hi:.2f}]."
                    )
            except (ValueError, TypeError):
                warnings_list.append(f"{col}: could not convert '{val}' to number.")
                row[col] = None

    # Categorical unseen checks
    for col in CATEGORICAL_FEATURES:
        val = str(row.get(col, "")).strip()
        row[col] = val
        known = training_categories.get(col, [])
        if val and val not in known:
            warnings_list.append(
                f"Unseen category for {col}: '{val}'. Model will use unknown handling."
            )

    X_pred = pd.DataFrame([row], columns=feature_order)
    y_pred = pipeline.predict(X_pred)[0]
    y_proba = pipeline.predict_proba(X_pred)[0]

    defect_prob = round(float(y_proba[1]), 6)
    non_defect_prob = round(float(y_proba[0]), 6)
    predicted_class = int(y_pred)
    predicted_label = label_mapping.get(str(predicted_class), str(predicted_class))

    return {
        "predicted_class": predicted_class,
        "predicted_label": predicted_label,
        "defect_probability": defect_prob,
        "non_defect_probability": non_defect_prob,
        "decision_threshold": 0.5,
        "warnings": warnings_list,
        "note": (
            "This probability is an uncalibrated model estimate, not a guaranteed confidence level. "
            "Do not use as a replacement for factory inspection."
        ),
    }
