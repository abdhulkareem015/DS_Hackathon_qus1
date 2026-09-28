import { useState, useEffect } from 'react'
import { getFilterOptions, getEvaluation, predict } from '../api'
import { useApp } from '../context'
import { Alert } from '../components/Alert'
import { Spinner } from '../components/Spinner'
import type { PredictionResult } from '../types'

const C = { iris: '#8052ff', amber: '#ffb829', teal: '#15846e', ash: '#9a9a9a' }
const NUM_FIELDS = ['Temperature', 'Pressure', 'Machine_Speed'] as const

export function PredictPage() {
  const { project } = useApp()
  const pid = project.projectId!

  const [opts,     setOpts]     = useState<{ machine_ids: string[]; raw_material_batches: string[]; operator_shifts: string[] } | null>(null)
  const [hasModel, setHasModel] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [result,   setResult]   = useState<PredictionResult | null>(null)
  const [form,     setForm]     = useState({ Machine_ID: '', Temperature: '', Pressure: '', Machine_Speed: '', Raw_Material_Batch: '', Operator_Shift: '' })

  useEffect(() => {
    if (!pid) return
    getFilterOptions(pid).then(r => {
      setOpts(r.data)
      setForm(f => ({ ...f, Machine_ID: r.data.machine_ids[0] ?? '', Raw_Material_Batch: r.data.raw_material_batches[0] ?? '', Operator_Shift: r.data.operator_shifts[0] ?? '' }))
    }).catch(() => {})
    getEvaluation(pid).then(() => setHasModel(true)).catch(() => {})
  }, [pid])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(''); setResult(null)
    try {
      const r = await predict(pid, {
        Machine_ID: form.Machine_ID, Temperature: parseFloat(form.Temperature),
        Pressure: parseFloat(form.Pressure), Machine_Speed: parseFloat(form.Machine_Speed),
        Raw_Material_Batch: form.Raw_Material_Batch, Operator_Shift: form.Operator_Shift,
      })
      setResult(r.data)
    } catch (e: unknown) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Prediction failed.')
    } finally { setLoading(false) }
  }

  if (!pid) return (
    <Shell>
      <Alert variant="warning">Upload a dataset on the Dataset page first.</Alert>
    </Shell>
  )

  return (
    <Shell>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 'clamp(40px,6vw,100px)', alignItems: 'start' }} className="pred-grid">

        {/* Left — form */}
        <div>
          {!hasModel && (
            <div style={{ marginBottom: 24 }}>
              <Alert variant="warning">No trained model found. Go to the Model page and train first.</Alert>
            </div>
          )}

          <p style={{ fontSize: 14, color: C.ash, fontWeight: 200, marginBottom: 40, maxWidth: 400 }}>
            Enter production parameters below. The model will return an estimated defect probability based on patterns in the training data.
          </p>

          <form onSubmit={handleSubmit}>
            {/* Categorical */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px 32px', marginBottom: 32 }}>
              <FormField label="Machine ID">
                <select value={form.Machine_ID} onChange={set('Machine_ID')} className="input" required>
                  <option value="">Select…</option>
                  {opts?.machine_ids.map(v => <option key={v} style={{ background: '#111' }}>{v}</option>)}
                </select>
              </FormField>
              <FormField label="Raw Material Batch">
                <select value={form.Raw_Material_Batch} onChange={set('Raw_Material_Batch')} className="input" required>
                  <option value="">Select…</option>
                  {opts?.raw_material_batches.map(v => <option key={v} style={{ background: '#111' }}>{v}</option>)}
                </select>
              </FormField>
              <FormField label="Operator Shift">
                <select value={form.Operator_Shift} onChange={set('Operator_Shift')} className="input" required>
                  <option value="">Select…</option>
                  {opts?.operator_shifts.map(v => <option key={v} style={{ background: '#111' }}>{v}</option>)}
                </select>
              </FormField>
            </div>

            {/* Numeric */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '28px 32px', marginBottom: 40 }}>
              {NUM_FIELDS.map(f => (
                <FormField key={f} label={f}>
                  <input type="number" step="any" value={form[f]} onChange={set(f)} className="input" placeholder="Enter value" required />
                </FormField>
              ))}
            </div>

            {error && <div style={{ marginBottom: 16 }}><Alert variant="error">{error}</Alert></div>}

            <button type="submit" className="btn-primary" disabled={!hasModel || loading} style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? <><Spinner size="sm" /> Predicting…</> : 'Predict Defect'}
            </button>
          </form>
        </div>

        {/* Right — result */}
        <div>
          {!result && (
            <div style={{ paddingTop: 64 }}>
              <p style={{ fontSize: 48, fontWeight: 400, color: '#111', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                Result will<br />appear here.
              </p>
              <p style={{ fontSize: 14, color: '#333', marginTop: 24, fontWeight: 200 }}>
                Submit the form to get a model estimate.
              </p>
            </div>
          )}

          {result && <PredictionResult result={result} />}
        </div>
      </div>

      <style>{`@media(max-width:767px){.pred-grid{grid-template-columns:1fr!important;}}`}</style>
    </Shell>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.ash, letterSpacing: '0.025em', textTransform: 'uppercase', marginBottom: 10 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function PredictionResult({ result }: { result: PredictionResult }) {
  const isDef = result.predicted_class === 1
  const prob  = result.defect_probability
  const pct   = (prob * 100).toFixed(1)
  const accentColor = isDef ? C.amber : C.teal

  return (
    <div>
      {/* Big result */}
      <div style={{ marginBottom: 40 }}>
        <p className="label-amber" style={{ marginBottom: 12 }}>Prediction</p>
        <p style={{ fontSize: 'clamp(40px,5vw,64px)', fontWeight: 400, color: accentColor, letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 8 }}>
          {result.predicted_label}
        </p>
        <p style={{ fontSize: 18, fontWeight: 200, color: '#9a9a9a' }}>
          Estimated defect probability: <span style={{ color: '#fff' }}>{pct}%</span>
        </p>
      </div>

      {/* Probability bar */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.ash, marginBottom: 8 }}>
          <span>0% Non-Defective</span>
          <span style={{ color: '#555' }}>Threshold {(result.decision_threshold * 100).toFixed(0)}%</span>
          <span>100% Defective</span>
        </div>
        <div style={{ width: '100%', height: 6, background: '#111', borderRadius: 3, position: 'relative' }}>
          {/* Threshold marker */}
          <div style={{ position: 'absolute', left: `${result.decision_threshold * 100}%`, top: -4, bottom: -4, width: 1, background: '#333' }} />
          {/* Fill */}
          <div style={{ width: `${pct}%`, height: '100%', background: accentColor, borderRadius: 3, transition: 'width .4s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.ash, marginTop: 8 }}>
          <span>Non-Defective: {(result.non_defect_probability * 100).toFixed(1)}%</span>
          <span style={{ color: accentColor }}>Defective: {pct}%</span>
        </div>
      </div>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {result.warnings.map((w, i) => (
            <p key={i} style={{ fontSize: 13, color: C.amber, fontWeight: 200, marginBottom: 6 }}>⚠ {w}</p>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <p style={{ fontSize: 13, color: '#555', fontWeight: 200, lineHeight: 1.6, borderTop: '1px solid #111', paddingTop: 20 }}>
        {result.note}
      </p>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#000', minHeight: '100vh', paddingBottom: 120 }}>
      <div className="section-inner" style={{ paddingTop: 'clamp(48px,6vw,96px)' }}>
        <h1 className="page-heading" style={{ marginBottom: 'clamp(32px,4vw,56px)' }}>Estimate defect risk.</h1>
        {children}
      </div>
    </div>
  )
}
