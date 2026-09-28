import { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle, AlertTriangle, Download, RefreshCw, Trash2 } from 'lucide-react'
import { uploadCSV, applyClean, dlCleanCSV } from '../api'
import { useApp } from '../context'
import { LoadingOverlay } from '../components/Spinner'
import { Alert } from '../components/Alert'
import { StatCard } from '../components/StatCard'
import { DataTable } from '../components/DataTable'
import type { ValidationReport } from '../types'

export function UploadPage() {
  const { project, setProject } = useApp()
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [preview, setPreview]   = useState<{ columns: string[]; rows: Record<string,unknown>[] } | null>(null)
  const [removeDups, setRemoveDups] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setLoading(true); setError('')
    try {
      const res = await uploadCSV(file)
      const d = res.data
      setProject(p => ({
        ...p,
        projectId: d.project_id,
        filename: d.filename,
        validationReport: d.validation_report,
        trainingStatus: 'not_started',
      }))
      setPreview(d.preview)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Upload failed.'
      setError(msg)
    } finally { setLoading(false) }
  }

  async function handleReClean() {
    if (!project.projectId) return
    setLoading(true); setError('')
    try {
      const res = await applyClean(project.projectId, { remove_duplicates: removeDups })
      setProject(p => ({ ...p, validationReport: res.data.validation_report }))
      setPreview(res.data.preview)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Cleaning failed.'
      setError(msg)
    } finally { setLoading(false) }
  }

  const vr = project.validationReport

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload & Data Quality</h1>
        <p className="text-gray-500 text-sm mt-1">Upload a CSV production dataset to begin analysis.</p>
      </div>

      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-brand-300 rounded-xl p-10 text-center bg-brand-50 hover:bg-brand-100 transition-colors cursor-pointer"
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      >
        <Upload className="w-10 h-10 text-brand-400 mx-auto mb-3" />
        <p className="font-semibold text-brand-700">Click or drag & drop a CSV file</p>
        <p className="text-sm text-brand-500 mt-1">Max 50 MB · Required columns: Batch_ID, Machine_ID, Temperature, Pressure, Machine_Speed, Raw_Material_Batch, Operator_Shift, Defect_Status</p>
        <input ref={fileRef} type="file" accept=".csv" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
      </div>

      {loading && <LoadingOverlay message="Uploading and validating…" />}
      {error   && <Alert variant="error">{error}</Alert>}

      {/* Validation Report */}
      {vr && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Original Rows"     value={vr.original_rows.toLocaleString()}        color="blue"   />
            <StatCard label="Usable Rows"        value={vr.usable_labeled_rows.toLocaleString()}  color="green"  />
            <StatCard label="Duplicate Rows"     value={vr.duplicate_rows.toLocaleString()}        color="orange" />
            <StatCard label="Overall Defect Rate" value={`${(vr.defect_rate*100).toFixed(2)}%`}   color="red"    />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Class distribution */}
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500"/>Class Distribution</h3>
              <div className="space-y-2">
                {Object.entries(vr.class_distribution).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className={k === '1' ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                      {k === '1' ? '🔴 Defective (1)' : '🟢 Non-Defective (0)'}
                    </span>
                    <span className="font-semibold">{v.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              {vr.single_class_warning && (
                <Alert variant="error" >{vr.single_class_warning}</Alert>
              )}
              <div className="mt-3 text-xs text-gray-500">
                <p><b>Target mapping:</b> {vr.target_mapping?.type as string}</p>
                {vr.invalid_target_rows > 0 && (
                  <p className="text-orange-600">⚠ {vr.invalid_target_rows} rows excluded (invalid/missing target)</p>
                )}
              </div>
            </div>

            {/* Missing values */}
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-yellow-500"/>Missing Values by Column</h3>
              {Object.keys(vr.missing_by_column).length === 0
                ? <p className="text-green-600 text-sm">✓ No missing values detected</p>
                : <div className="space-y-1">
                    {Object.entries(vr.missing_by_column).map(([col, n]) => (
                      <div key={col} className="flex justify-between text-sm">
                        <span className="text-gray-700">{col}</span>
                        <span className="text-orange-600 font-medium">{n.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
              }
              {Object.keys(vr.invalid_numeric_by_column).length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-gray-700 mb-1">Non-numeric values converted to NaN:</p>
                  {Object.entries(vr.invalid_numeric_by_column).map(([col, n]) => (
                    <div key={col} className="flex justify-between text-sm">
                      <span>{col}</span><span className="text-red-600">{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Outliers */}
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-3">Outliers Flagged (3×IQR fence)</h3>
              {Object.keys(vr.outliers_flagged).length === 0
                ? <p className="text-green-600 text-sm">✓ No extreme outliers detected</p>
                : <div className="space-y-2">
                    {Object.entries(vr.outliers_flagged).map(([col, info]) => (
                      <div key={col} className="text-sm">
                        <span className="font-medium text-gray-800">{col}:</span>{' '}
                        <span className="text-orange-600">{info.count} records</span>{' '}
                        <span className="text-gray-400">(fences: {info.lower_fence} – {info.upper_fence})</span>
                      </div>
                    ))}
                    <p className="text-xs text-gray-400 mt-2">Flagged for review only — not auto-removed.</p>
                  </div>
              }
            </div>

            {/* Applied cleaning */}
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-3">Applied Cleaning Steps</h3>
              <ul className="space-y-1">
                {vr.applied_cleaning.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    {s}
                  </li>
                ))}
              </ul>

              {/* Duplicate removal option */}
              {vr.duplicate_rows > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800 font-medium mb-2">
                    ⚠ {vr.duplicate_rows} exact duplicate rows found
                  </p>
                  <p className="text-xs text-yellow-700 mb-2">
                    Identical inspections may be legitimate. Review before removing.
                  </p>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={removeDups} onChange={e => setRemoveDups(e.target.checked)}
                      className="rounded" />
                    Remove duplicate rows
                  </label>
                  <button onClick={handleReClean} className="btn-primary text-xs mt-2 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Apply
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Numeric stats */}
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-3">Numeric Feature Statistics</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-50">
                  <tr>{['Feature','Count','Missing','Mean','Std','Min','P25','Median','P75','Max'].map(h=>(
                    <th key={h} className="px-3 py-2 text-xs text-gray-500 text-right border-b first:text-left">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {Object.entries(vr.numeric_stats).map(([col, s]) => (
                    <tr key={col} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-800">{col}</td>
                      {[s.count,s.missing,s.mean,s.std,s.min,s.p25,s.median,s.p75,s.max].map((v,i)=>(
                        <td key={i} className="px-3 py-2 text-right tabular-nums text-gray-600">{typeof v==='number'?v.toFixed(2):v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Downloads */}
          <div className="flex flex-wrap gap-3">
            <a href={dlCleanCSV(project.projectId!)} className="btn-secondary flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" /> Download Cleaned CSV
            </a>
          </div>
        </>
      )}

      {/* Data Preview */}
      {preview && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Data Preview (first 20 rows)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>{preview.columns.map(c=>(
                  <th key={c} className="px-2 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{c}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {preview.columns.map(c=>(
                      <td key={c} className={`px-2 py-1.5 ${c==='Defect_Status'&&row[c]===1?'text-red-600 font-medium':'text-gray-700'}`}>
                        {row[c]===null||row[c]===undefined ? <span className="text-gray-300">—</span> : String(row[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2">Total rows: {preview.rows.length} shown of {project.validationReport?.usable_labeled_rows?.toLocaleString()}</p>
        </div>
      )}

      {!vr && !loading && (
        <div className="card text-center py-12">
          <Upload className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">Upload a CSV file to start</p>
          <p className="text-xs text-gray-300 mt-1">Supported target formats: 0/1, Yes/No, True/False, Defective/Non-Defective</p>
        </div>
      )}
    </div>
  )
}
