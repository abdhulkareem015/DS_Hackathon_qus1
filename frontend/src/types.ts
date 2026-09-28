// ─── Shared types ────────────────────────────────────────────────────────────

export interface ProjectState {
  projectId: string | null
  filename: string | null
  validationReport: ValidationReport | null
  trainingStatus: 'not_started' | 'running' | 'completed' | 'failed'
}

export interface ValidationReport {
  original_rows: number
  usable_labeled_rows: number
  duplicate_rows: number
  duplicates_removed: number
  missing_by_column: Record<string, number>
  invalid_numeric_by_column: Record<string, number>
  invalid_target_rows: number
  target_mapping: Record<string, unknown>
  class_distribution: Record<string, number>
  single_class_warning?: string
  outliers_flagged: Record<string, { count: number; lower_fence: number; upper_fence: number }>
  numeric_stats: Record<string, NumericStat>
  defect_rate: number
  applied_cleaning: string[]
}

export interface NumericStat {
  count: number
  mean: number
  std: number
  min: number
  p25: number
  median: number
  p75: number
  max: number
  missing: number
}

export interface SummaryStats {
  inspected: number
  defective: number
  non_defective: number
  defect_rate: number
  machines: number
  batches: number
  raw_material_batches: number
  shifts: number
}

export interface DefectRateRow {
  [key: string]: string | number | boolean | null
  inspected: number
  defective: number
  defect_rate: number
  ci_lower: number
  ci_upper: number
  diff_from_overall: number
  lift: number | null
  small_sample: boolean
}

export interface FilterOptions {
  machine_ids: string[]
  batch_ids: string[]
  raw_material_batches: string[]
  operator_shifts: string[]
}

export interface Filters {
  machine_id: string
  batch_id: string
  raw_material_batch: string
  operator_shift: string
}

export interface ScatterPoint {
  [key: string]: number
  defect: number
}

export interface HeatmapCell {
  temp_band: string
  speed_band: string
  inspected: number
  defective: number
  defect_rate: number
  low_sample: boolean
}

export interface HighRiskRow {
  [key: string]: string | number | boolean
  inspected: number
  defective: number
  defect_rate: number
  diff_from_overall: number
  lift: number | null
  below_min_support: boolean
}

export interface EvaluationReport {
  split_method: string
  train_samples: number
  test_samples: number
  train_class_distribution: Record<string, number>
  test_class_distribution: Record<string, number>
  random_forest: ModelMetrics
  dummy_baseline: ModelMetrics
  permutation_importance: ImportanceRow[]
  decision_threshold: number
  training_ranges: Record<string, { min: number; max: number }>
  training_categories: Record<string, string[]>
}

export interface ModelMetrics {
  label: string
  accuracy: number
  precision_defective: number
  recall_defective: number
  f1_defective: number
  roc_auc?: number
  avg_precision?: number
  confusion_matrix: number[][]
  classification_report: Record<string, unknown>
}

export interface ImportanceRow {
  feature: string
  importance_mean: number
  importance_std: number
  error?: string
}

export interface PredictionResult {
  predicted_class: number
  predicted_label: string
  defect_probability: number
  non_defect_probability: number
  decision_threshold: number
  warnings: string[]
  note: string
}

export interface Insight {
  id: number
  title: string
  text: string
  supporting_numbers: Record<string, unknown>
  category: string
}

export interface ActionPlanRow {
  finding: string
  recommendation: string
  responsible_role: string
  priority: string
  metric_to_monitor: string
  validation_method: string
}
