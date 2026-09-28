import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { uploadCSV, applyClean, dlCleanCSV } from '../api'
import { useApp } from '../context'
import { LoadingOverlay, Spinner } from '../components/Spinner'
import { Alert } from '../components/Alert'
import type { ValidationReport } from '../types'

export function DatasetPage() {
  const { project, setProject } = useApp()
  const navigate = useNavigate()
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
      setProject(p => ({ ...p, projectId: d.project_id, filename: d.filename, validationReport: d.validation_report, trainingStatus: 'not_started' }))
      setPreview(d.preview)
    } catch (e: unknown) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Upload failed.')
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
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Cleaning failed.')
    } finally { setLoading(false) }
  }

  const vr = project.validationReport

  return (
    <div style={{ background: '#000', minHeight: '100vh', paddingBottom: 120 }}>
      <div className="section-inner" style={{ paddingTop: 'clamp(48px,6vw,96px)' }}>

        {/* ── Two-column hero ───────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,0.9fr)', gap: 'clamp(40px,5vw,100px)', alignItems: 'start' }}
          className="ds-grid">
          {/* Left */}
          <div>
            <p className="label-amber" style={{ marginBottom: 20 }}>Production Data</p>
            <h1 className="page-heading" style={{ marginBottom: 24 }}>Start with your<br />production data.</h1>
            <p className="body-muted" style={{ maxWidth: 460, marginBottom: 32 }}>
              Upload a CSV with columns: <span style={{ color: '#fff', fontWeight: 400 }}>Batch_ID, Machine_ID, Temperature,
              Pressure, Machine_Speed, Raw_Material_Batch, Operator_Shift, Defect_Status.</span>
            </p>
            <p style={{ fontSize: 13, color: '#9a9a9a', fontWeight: 200 }}>
              Supported target formats: <span style={{ color: '#fff' }}>0/1 · Yes/No · True/False · Defective/Non-Defective</span>
            </p>
          </div>

          {/* Right — upload control */}
          <div>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />

            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              style={{
                border: '1px solid #222',
                borderRadius: 16,
                padding: 'clamp(32px,4vw,56px)',
                cursor: 'pointer',
                transition: 'border-color .2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#8052ff')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#222')}
            >
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                  <Spinner size="md" />
                  <p style={{ color: '#9a9a9a', fontSize: 14, fontWeight: 200 }}>Uploading & validating…</p>
                </div>
              ) : project.filename ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <CheckCircle2 size={18} color="#15846e" />
                    <span style={{ color: '#fff', fontSize: 15, fontWeight: 400 }}>{project.filename}</span>
                  </div>
                  <p style={{ color: '#9a9a9a', fontSize: 13, fontWeight: 200 }}>
                    {vr?.usable_labeled_rows?.toLocaleString()} usable records ·{' '}
                    {vr ? `${(vr.defect_rate*100).toFixed(2)}% defect rate` : ''}
                  </p>
                  <p style={{ color: '#8052ff', fontSize: 12, marginTop: 12, fontWeight: 400 }}>Click to replace file</p>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: '#fff', fontSize: 18, fontWeight: 400, marginBottom: 8 }}>Choose CSV file</p>
                  <p style={{ color: '#9a9a9a', fontSize: 14, fontWeight: 200 }}>or drag & drop · Max 50 MB</p>
                  <button className="btn-primary" style={{ marginTop: 24 }} onClick={e => { e.stopPropagation(); fileRef.current?.click() }}>
                    Choose CSV
                  </button>
                </div>
              )}
            </div>

            {error && <div style={{ marginTop: 16 }}><Alert variant="error">{error}</Alert></div>}

            {vr && (
              <div style={{ marginTop: 32 }}>
                {/* Quick stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                  <QStat label="Original rows"   value={vr.original_rows.toLocaleString()} />
                  <QStat label="Usable rows"      value={vr.usable_labeled_rows.toLocaleString()} accent="#15846e" />
                  <QStat label="Defect rate"      value={`${(vr.defect_rate*100).toFixed(2)}%`} accent="#ffb829" />
                  <QStat label="Duplicates"       value={vr.duplicate_rows.toLocaleString()} />
                </div>

                {/* Class dist */}
                <div style={{ borderTop: '1px solid #111', paddingTop: 20, marginBottom: 20 }}>
                  <p className="label-gray" style={{ marginBottom: 12 }}>Class distribution</p>
                  {Object.entries(vr.class_distribution).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 14, color: k === '1' ? '#ffb829' : '#9a9a9a', fontWeight: 200 }}>
                        {k === '1' ? 'Defective' : 'Non-Defective'}
                      </span>
                      <span style={{ fontSize: 14, color: '#fff', fontWeight: 400 }}>{(v as number).toLocaleString()}</span>
                    </div>
                  ))}
                  {vr.single_class_warning && (
                    <div style={{ marginTop: 12 }}><Alert variant="error">{vr.single_class_warning}</Alert></div>
                  )}
                </div>

                {/* Missing values */}
                {Object.keys(vr.missing_by_column).length > 0 && (
                  <div style={{ borderTop: '1px solid #111', paddingTop: 20, marginBottom: 20 }}>
                    <p className="label-gray" style={{ marginBottom: 12 }}>Missing values</p>
                    {Object.entries(vr.missing_by_column).map(([col, n]) => (
                      <div key={col} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 14, color: '#9a9a9a', fontWeight: 200 }}>{col}</span>
                        <span style={{ fontSize: 14, color: '#ffb829', fontWeight: 400 }}>{(n as number).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Outliers */}
                {Object.keys(vr.outliers_flagged).length > 0 && (
                  <div style={{ borderTop: '1px solid #111', paddingTop: 20, marginBottom: 20 }}>
                    <p className="label-gray" style={{ marginBottom: 12 }}>Outliers flagged (3×IQR)</p>
                    {Object.entries(vr.outliers_flagged).map(([col, info]) => (
                      <div key={col} style={{ fontSize: 13, color: '#9a9a9a', marginBottom: 6, fontWeight: 200 }}>
                        <span style={{ color: '#fff' }}>{col}</span>: {info.count} records
                        <span style={{ color: '#555' }}> (fences {info.lower_fence}–{info.upper_fence})</span>
                      </div>
                    ))}
                    <p style={{ fontSize: 12, color: '#555', marginTop: 8, fontWeight: 200 }}>Flagged for review — not auto-removed.</p>
                  </div>
                )}

                {/* Duplicates option */}
                {vr.duplicate_rows > 0 && (
                  <div style={{ borderTop: '1px solid #111', paddingTop: 20, marginBottom: 20 }}>
                    <p style={{ fontSize: 14, color: '#ffb829', marginBottom: 8, fontWeight: 200 }}>
                      {vr.duplicate_rows} exact duplicate rows found.
                      Identical inspections may be legitimate. Review before removing.
                    </p>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: '#9a9a9a', fontWeight: 200 }}>
                      <input type="checkbox" checked={removeDups} onChange={e => setRemoveDups(e.target.checked)}
                        style={{ accentColor: '#8052ff' }} />
                      Remove duplicate rows
                    </label>
                    <button onClick={handleReClean} className="btn-ghost" style={{ marginTop: 8 }}>
                      Apply cleaning
                    </button>
                  </div>
                )}

                {/* Applied cleaning */}
                <div style={{ borderTop: '1px solid #111', paddingTop: 20, marginBottom: 24 }}>
                  <p className="label-gray" style={{ marginBottom: 12 }}>Applied cleaning</p>
                  {vr.applied_cleaning.map((s, i) => (
                    <p key={i} style={{ fontSize: 13, color: '#9a9a9a', marginBottom: 6, fontWeight: 200 }}>✓ {s}</p>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                  <button className="btn-primary" onClick={() => navigate('/analysis')}>
                    Explore Analysis <ArrowRight size={14} />
                  </button>
                  <a href={dlCleanCSV(project.projectId!)} className="btn-ghost">
                    Download Cleaned CSV
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Numeric stats table ────────────────────────────── */}
        {vr && Object.keys(vr.numeric_stats).length > 0 && (
          <div style={{ marginTop: 'clamp(60px,8vw,120px)', borderTop: '1px solid #111', paddingTop: 60 }}>
            <p className="label-amber" style={{ marginBottom: 24 }}>Numeric feature statistics</p>
            <div style={{ overflowX: 'auto' }}>
              <table className="da-table">
                <thead>
                  <tr>
                    {['Feature','Count','Missing','Mean','Std','Min','P25','Median','P75','Max'].map(h=>(
                      <th key={h} style={{ textAlign: h === 'Feature' ? 'left' : 'right' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(vr.numeric_stats).map(([col, s]) => (
                    <tr key={col}>
                      <td style={{ color: '#fff' }}>{col}</td>
                      {[s.count, s.missing, s.mean, s.std, s.min, s.p25, s.median, s.p75, s.max].map((v,i) => (
                        <td key={i} className="right" style={{ color: i === 1 && (v as number) > 0 ? '#ffb829' : '#bdbdbd' }}>
                          {typeof v === 'number' ? v.toFixed(2) : v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Data preview ───────────────────────────────────── */}
        {preview && (
          <div style={{ marginTop: 60, borderTop: '1px solid #111', paddingTop: 60 }}>
            <p className="label-amber" style={{ marginBottom: 24 }}>
              Data preview — first 20 rows
              {project.filename?.toLowerCase().includes('synthetic') && (
                <span className="badge-amber" style={{ marginLeft: 12 }}>SYNTHETIC</span>
              )}
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table className="da-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>{preview.columns.map(c => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={i}>
                      {preview.columns.map(c => (
                        <td key={c} style={c === 'Defect_Status' && row[c] === 1 ? { color: '#ffb829' } : {}}>
                          {row[c] === null || row[c] === undefined ? <span style={{ color: '#333' }}>—</span> : String(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="caption" style={{ marginTop: 12 }}>
              {preview.rows.length} rows shown of {vr?.usable_labeled_rows?.toLocaleString()}
            </p>
          </div>
        )}

        {!vr && !loading && (
          <div style={{ marginTop: 120, textAlign: 'center' }}>
            <p style={{ color: '#333', fontSize: 18, fontWeight: 200 }}>No dataset uploaded yet.</p>
          </div>
        )}
      </div>

      <style>{`@media(max-width:767px){.ds-grid{grid-template-columns:1fr!important;}}`}</style>
    </div>
  )
}

function QStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div style={{ fontSize: 'clamp(22px,2.5vw,32px)', fontWeight: 400, color: accent ?? '#fff', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#9a9a9a', textTransform: 'uppercase', letterSpacing: '0.025em', marginTop: 4 }}>{label}</div>
    </div>
  )
}
