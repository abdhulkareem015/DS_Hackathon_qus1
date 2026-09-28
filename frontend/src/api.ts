import axios from 'axios'

const BASE = ''  // uses Vite proxy → http://localhost:8000

export const api = axios.create({ baseURL: BASE })

// ── Upload & Validation ──────────────────────────────────────────────────────
export const uploadCSV = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/projects/upload', form)
}

export const getValidation   = (pid: string) => api.get(`/projects/${pid}/validation`)
export const getPreview      = (pid: string, n = 20) => api.get(`/projects/${pid}/preview?n=${n}`)
export const applyClean      = (pid: string, opts: object) => api.post(`/projects/${pid}/clean`, opts)

// ── Analysis ─────────────────────────────────────────────────────────────────
export const getFilterOptions = (pid: string) => api.get(`/projects/${pid}/filter-options`)

export const getSummary = (pid: string, filters: Record<string,string>) =>
  api.get(`/projects/${pid}/summary`, { params: cleanParams(filters) })

export const getDefectRates = (pid: string, filters: Record<string,string>) =>
  api.get(`/projects/${pid}/defect-rates`, { params: cleanParams(filters) })

export const getMachineChart = (pid: string, filters: Record<string,string>) =>
  api.get(`/projects/${pid}/charts/machine-defect`, { params: cleanParams(filters) })

export const getRMChart = (pid: string, filters: Record<string,string>) =>
  api.get(`/projects/${pid}/charts/raw-material-defect`, { params: cleanParams(filters) })

export const getScatter = (pid: string, xCol: string, yCol: string, filters: Record<string,string>) =>
  api.get(`/projects/${pid}/charts/scatter`, { params: { x_col: xCol, y_col: yCol, ...cleanParams(filters) } })

export const getHeatmap = (pid: string, filters: Record<string,string>) =>
  api.get(`/projects/${pid}/charts/heatmap`, { params: cleanParams(filters) })

export const getHighRisk = (pid: string, minSupport: number, filters: Record<string,string>) =>
  api.get(`/projects/${pid}/high-risk`, { params: { min_support: minSupport, ...cleanParams(filters) } })

// ── Training ─────────────────────────────────────────────────────────────────
export const startTraining    = (pid: string) => api.post(`/projects/${pid}/train`)
export const getTrainingStatus = (pid: string) => api.get(`/projects/${pid}/train/status`)
export const getEvaluation    = (pid: string) => api.get(`/projects/${pid}/evaluation`)

// ── Prediction ───────────────────────────────────────────────────────────────
export const predict = (pid: string, body: object) => api.post(`/projects/${pid}/predict`, body)

// ── Insights ─────────────────────────────────────────────────────────────────
export const getInsights = (pid: string) => api.get(`/projects/${pid}/insights`)

// ── Downloads ────────────────────────────────────────────────────────────────
export const dlCleanCSV   = (pid: string) => `${BASE}/projects/${pid}/download/clean-csv`
export const dlEvalJSON   = (pid: string) => `${BASE}/projects/${pid}/download/evaluation-json`
export const dlHTMLReport = (pid: string) => `${BASE}/projects/${pid}/download/html-report`

function cleanParams(f: Record<string,string>) {
  return Object.fromEntries(Object.entries(f).filter(([,v]) => v && v !== ''))
}
