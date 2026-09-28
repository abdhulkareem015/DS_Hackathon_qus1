import { useState, useEffect, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { startTraining, getTrainingStatus, getEvaluation, dlEvalJSON } from '../api'
import { useApp } from '../context'
import { Spinner } from '../components/Spinner'
import { Alert } from '../components/Alert'
import { DataTable } from '../components/DataTable'
import type { EvaluationReport } from '../types'

const C = { iris: '#8052ff', amber: '#ffb829', teal: '#15846e', ash: '#9a9a9a', silver: '#bdbdbd' }
const AXIS = { fill: C.ash, fontSize: 11 }
const TT: React.CSSProperties = { background: '#0a0a0a', border: '1px solid #222', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: C.silver }

export function TrainingPage() {
  const { project, setProject } = useApp()
  const pid = project.projectId!
  const [status,   setStatus]   = useState<{ status: string; message: string }>({ status: 'not_started', message: '' })
  const [report,   setReport]   = useState<EvaluationReport | null>(null)
  const [error,    setError]    = useState('')
  const [starting, setStarting] = useState(false)
  const poll = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    getEvaluation(pid).then(r => setReport(r.data)).catch(() => {})
    getTrainingStatus(pid).then(r => setStatus(r.data)).catch(() => {})
  }, [pid])

  useEffect(() => {
    if (status.status !== 'running') return
    poll.current = setInterval(async () => {
      try {
        const r = await getTrainingStatus(pid)
        setStatus(r.data)
        if (r.data.status === 'completed') {
          setProject(p => ({ ...p, trainingStatus: 'completed' }))
          const ev = await getEvaluation(pid)
          setReport(ev.data)
          clearInterval(poll.current!)
        } else if (r.data.status === 'failed') {
          setProject(p => ({ ...p, trainingStatus: 'failed' }))
          clearInterval(poll.current!)
        }
      } catch { /* ignore */ }
    }, 2000)
    return () => { if (poll.current) clearInterval(poll.current) }
  }, [status.status, pid])

  async function handleTrain() {
    setStarting(true); setError('')
    try {
      await startTraining(pid)
      setStatus({ status: 'running', message: 'Training started…' })
      setProject(p => ({ ...p, trainingStatus: 'running' }))
    } catch (e: unknown) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to start training.')
    } finally { setStarting(false) }
  }

  if (!pid) return (
    <Shell>
      <Alert variant="warning">Upload a dataset on the Dataset page first.</Alert>
    </Shell>
  )

  const rf  = report?.random_forest
  const dum = report?.dummy_baseline
  const imp = (report?.permutation_importance ?? []).filter(x => 'importance_mean' in x)

  return (
    <Shell>
      {/* ── Two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 'clamp(40px,5vw,80px)', alignItems: 'start' }} className="train-grid">

        {/* Left — config + controls */}
        <div>
          <p className="label-amber" style={{ marginBottom: 20 }}>Random Forest Classifier</p>

          <div style={{ marginBottom: 32 }}>
            {[
              ['Algorithm',       'RandomForestClassifier (scikit-learn)'],
              ['Trees / Depth',   '200 trees · max depth 10'],
              ['Class weight',    'balanced — handles class imbalance'],
              ['Random seed',     '42 — fully reproducible'],
              ['Split strategy',  'Batch-aware GroupShuffleSplit 80 / 20'],
              ['Imputation',      'Median (numeric) · constant (categorical)'],
              ['Batch_ID',        'Used for splitting only — excluded from features'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 16, marginBottom: 10, borderBottom: '1px solid #0d0d0d', paddingBottom: 10 }}>
                <span style={{ fontSize: 13, color: C.ash, minWidth: 130, fontWeight: 200 }}>{k}</span>
                <span style={{ fontSize: 13, color: '#fff', fontWeight: 200 }}>{v}</span>
              </div>
            ))}
          </div>

          {error && <div style={{ marginBottom: 16 }}><Alert variant="error">{error}</Alert></div>}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            <button className="btn-primary" onClick={handleTrain} disabled={starting || status.status === 'running'}>
              {status.status === 'running' ? <><Spinner size="sm" /> Training…</> : report ? 'Retrain Model' : 'Train Random Forest'}
            </button>
            {report && (
              <a href={dlEvalJSON(pid)} className="btn-ghost">
                Download Evaluation JSON
              </a>
            )}
          </div>

          {status.status === 'running' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, color: C.iris, fontSize: 14, fontWeight: 200 }}>
              <Spinner size="sm" /> Training in progress — typically 30–60 seconds…
            </div>
          )}
          {status.status === 'failed' && (
            <div style={{ marginTop: 16 }}><Alert variant="error">{status.message}</Alert></div>
          )}

          {!report && status.status === 'not_started' && (
            <p style={{ marginTop: 40, color: '#333', fontSize: 14, fontWeight: 200 }}>Click "Train Random Forest" to begin.</p>
          )}
        </div>

        {/* Right — status / split info */}
        <div>
          {report && (
            <>
              <p className="label-amber" style={{ marginBottom: 20 }}>Dataset Split</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
                <QStat label="Train records" value={report.train_samples?.toLocaleString()} />
                <QStat label="Test records"  value={report.test_samples?.toLocaleString()} />
                <div style={{ gridColumn: '1/-1' }}>
                  <p style={{ fontSize: 12, color: C.ash, fontWeight: 200 }}>{report.split_method}</p>
                  <p style={{ fontSize: 12, color: C.ash, marginTop: 4, fontWeight: 200 }}>
                    Train: {Object.entries(report.train_class_distribution).map(([k,v])=>`${k}: ${v}`).join(' · ')}
                  </p>
                  <p style={{ fontSize: 12, color: C.ash, fontWeight: 200 }}>
                    Test: {Object.entries(report.test_class_distribution).map(([k,v])=>`${k}: ${v}`).join(' · ')}
                  </p>
                </div>
              </div>

              {/* Key metrics */}
              {rf && (
                <>
                  <p className="label-amber" style={{ marginBottom: 20 }}>Held-Out Test Metrics</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
                    <BigMetric label="Accuracy"    value={rf.accuracy.toFixed(4)} />
                    <BigMetric label="Recall (defect)"  value={rf.recall_defective.toFixed(4)} accent={C.amber} />
                    <BigMetric label="Precision"   value={rf.precision_defective.toFixed(4)} />
                    <BigMetric label="F1 Score"    value={rf.f1_defective.toFixed(4)} accent={C.iris} />
                    {rf.roc_auc != null && <BigMetric label="ROC-AUC" value={rf.roc_auc.toFixed(4)} />}
                    {rf.avg_precision != null && <BigMetric label="Avg Precision" value={rf.avg_precision.toFixed(4)} />}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Full-width evaluation details ── */}
      {report && rf && dum && (
        <>
          {/* RF vs Dummy */}
          <div style={{ marginTop: 'clamp(60px,7vw,100px)', borderTop: '1px solid #111', paddingTop: 60 }}>
            <p className="label-amber" style={{ marginBottom: 12 }}>Random Forest vs Dummy Baseline</p>
            <p style={{ fontSize: 14, color: C.ash, marginBottom: 32, fontWeight: 200, maxWidth: 640 }}>
              A dummy classifier always predicts the majority class. Comparing against it shows whether the model genuinely learned.
              For defect detection, <span style={{ color: '#fff' }}>recall</span> (catching real defects) matters more than accuracy.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table className="da-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th className="right">Random Forest</th>
                    <th className="right">Dummy Baseline</th>
                    <th className="right">Improvement</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Accuracy',            rf.accuracy,            dum.accuracy],
                    ['Precision (defective)', rf.precision_defective, dum.precision_defective],
                    ['Recall (defective)',  rf.recall_defective,    dum.recall_defective],
                    ['F1 Score',            rf.f1_defective,        dum.f1_defective],
                    ...(rf.roc_auc != null ? [['ROC-AUC', rf.roc_auc, dum.roc_auc ?? 0]] : []),
                  ].map(([label, rv, dv]) => {
                    const diff = (rv as number) - (dv as number)
                    return (
                      <tr key={String(label)}>
                        <td style={{ color: '#fff' }}>{label}</td>
                        <td className="right" style={{ color: C.iris }}>{(rv as number).toFixed(4)}</td>
                        <td className="right">{(dv as number).toFixed(4)}</td>
                        <td className="right" style={{ color: diff > 0 ? C.teal : '#f87171' }}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(4)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Confusion matrices */}
          <div style={{ marginTop: 60, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 48 }}>
            <ConfMatrix matrix={rf.confusion_matrix}  title="Random Forest" />
            <ConfMatrix matrix={dum.confusion_matrix} title="Dummy Baseline" />
          </div>

          {/* Permutation importance */}
          {imp.length > 0 && (
            <div style={{ marginTop: 'clamp(60px,7vw,100px)', borderTop: '1px solid #111', paddingTop: 60 }}>
              <p className="label-amber" style={{ marginBottom: 12 }}>Permutation Feature Importance</p>
              <p style={{ fontSize: 14, color: C.ash, marginBottom: 32, fontWeight: 200, maxWidth: 640 }}>
                How much model F1 drops when each feature is randomly shuffled on the held-out test set.
                Higher = stronger predictive association. <span style={{ color: '#fff' }}>This does not establish causation.</span>
              </p>
              <ResponsiveContainer width="100%" height={Math.max(200, imp.length * 38)}>
                <BarChart data={[...imp].reverse()} layout="vertical" margin={{ left: 110, right: 40 }}>
                  <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="feature" tick={AXIS} width={110} axisLine={false} tickLine={false} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload
                    return <div style={TT}><p style={{ color: '#fff' }}>{d.feature}</p><p>Mean F1 drop: {d.importance_mean?.toFixed(6)}</p><p>± {d.importance_std?.toFixed(6)}</p></div>
                  }} cursor={{ fill: 'rgba(128,82,255,0.06)' }} />
                  <Bar dataKey="importance_mean" fill={C.iris} radius={[0,3,3,0]} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 32 }}>
                <DataTable
                  data={imp}
                  columns={[
                    { key: 'feature',         header: 'Feature' },
                    { key: 'importance_mean', header: 'Mean F1 Importance', align: 'right', render: r => (r.importance_mean as number).toFixed(6) },
                    { key: 'importance_std',  header: '± Std',              align: 'right', render: r => (r.importance_std  as number).toFixed(6) },
                  ]}
                />
              </div>
            </div>
          )}

          {/* Interpretation notes */}
          <div style={{ marginTop: 60, borderTop: '1px solid #111', paddingTop: 48 }}>
            <p className="label-amber" style={{ marginBottom: 20 }}>Interpretation Notes</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 24 }}>
              {[
                ['False Positives', 'Predicted defective, actually good. Causes unnecessary rework or waste.'],
                ['False Negatives', 'Predicted good, actually defective. Allows defects through — usually the higher cost.'],
                ['Accuracy caveat', 'Accuracy alone is misleading for imbalanced datasets. Prioritise recall and F1 for defect detection.'],
                ['Decision threshold', `Currently ${report.decision_threshold}. Lowering it increases recall but reduces precision.`],
                ['Causation', 'Feature importance reflects statistical patterns in this dataset only — not engineering causality.'],
                ['Retraining', 'Retrain the model as more data accumulates or after process changes.'],
              ].map(([title, body]) => (
                <div key={title}>
                  <p style={{ fontSize: 14, fontWeight: 400, color: '#fff', marginBottom: 6 }}>{title}</p>
                  <p style={{ fontSize: 13, fontWeight: 200, color: C.ash, lineHeight: 1.6 }}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <style>{`@media(max-width:767px){.train-grid{grid-template-columns:1fr!important;}}`}</style>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#000', minHeight: '100vh', paddingBottom: 120 }}>
      <div className="section-inner" style={{ paddingTop: 'clamp(48px,6vw,96px)' }}>
        <h1 className="page-heading" style={{ marginBottom: 'clamp(32px,4vw,56px)' }}>Learn from production patterns.</h1>
        {children}
      </div>
    </div>
  )
}

function QStat({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div style={{ fontSize: 'clamp(24px,2.5vw,36px)', fontWeight: 400, color: '#fff', letterSpacing: '-0.03em' }}>{value ?? '—'}</div>
      <div style={{ fontSize: 11, color: '#9a9a9a', textTransform: 'uppercase', letterSpacing: '0.025em', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function BigMetric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ borderBottom: '1px solid #111', paddingBottom: 16 }}>
      <div style={{ fontSize: 28, fontWeight: 400, color: accent ?? '#fff', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#9a9a9a', textTransform: 'uppercase', letterSpacing: '0.025em', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function ConfMatrix({ matrix, title }: { matrix: number[][]; title: string }) {
  if (!matrix?.length) return null
  const [[tn, fp], [fn, tp]] = matrix
  const cells = [
    { val: tn, label: 'TN', sub: 'Correctly non-defective', bg: 'rgba(21,132,110,0.18)' },
    { val: fp, label: 'FP', sub: 'False alarm',              bg: 'rgba(239,68,68,0.12)'  },
    { val: fn, label: 'FN', sub: 'Missed defect',            bg: 'rgba(255,184,41,0.12)' },
    { val: tp, label: 'TP', sub: 'Correctly defective',      bg: 'rgba(128,82,255,0.18)' },
  ]
  const headers = ['', 'Pred: Non-Def', 'Pred: Defective']
  const rowLabels = ['Actual: Non-Def', 'Actual: Defective']
  return (
    <div>
      <p style={{ fontSize: 15, fontWeight: 400, color: '#fff', marginBottom: 20 }}>{title} — Confusion Matrix</p>
      <table style={{ borderCollapse: 'separate', borderSpacing: 6 }}>
        <thead>
          <tr>{headers.map(h => <th key={h} style={{ fontSize: 11, color: '#9a9a9a', fontWeight: 400, padding: '4px 8px', textAlign: 'center' }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {[0,1].map(row => (
            <tr key={row}>
              <td style={{ fontSize: 11, color: '#9a9a9a', fontWeight: 200, padding: '4px 8px', whiteSpace: 'nowrap' }}>{rowLabels[row]}</td>
              {[0,1].map(col => {
                const c = cells[row * 2 + col]
                return (
                  <td key={col} style={{ background: c.bg, borderRadius: 8, padding: '16px 20px', textAlign: 'center', minWidth: 90 }}>
                    <div style={{ fontSize: 28, fontWeight: 400, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{c.val}</div>
                    <div style={{ fontSize: 11, color: '#9a9a9a', fontWeight: 600, letterSpacing: '0.02em' }}>{c.label}</div>
                    <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{c.sub}</div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
