import { useState, useEffect } from 'react'
import { getInsights, dlHTMLReport } from '../api'
import { useApp } from '../context'
import { LoadingOverlay } from '../components/Spinner'
import { Alert } from '../components/Alert'
import type { Insight, ActionPlanRow } from '../types'

const C = { iris: '#8052ff', amber: '#ffb829', teal: '#15846e', ash: '#9a9a9a', silver: '#bdbdbd' }

const PRIORITY_ACCENT: Record<string, string> = {
  High:   C.amber,
  Medium: C.iris,
  Low:    C.ash,
}

export function InsightsPage() {
  const { project } = useApp()
  const pid = project.projectId!

  const [data,    setData]    = useState<{ insights: Insight[]; action_plan: ActionPlanRow[]; overall_defect_rate: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (!pid) return
    setLoading(true)
    getInsights(pid)
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.detail ?? 'Failed to load insights.'))
      .finally(() => setLoading(false))
  }, [pid])

  if (!pid) return (
    <Shell pid={null}>
      <Alert variant="warning">Upload a dataset on the Dataset page first.</Alert>
    </Shell>
  )

  return (
    <Shell pid={pid} hasData={!!data}>
      {/* Observational caveat */}
      <p style={{ fontSize: 14, color: C.ash, fontWeight: 200, maxWidth: 640, marginBottom: 'clamp(40px,5vw,72px)', lineHeight: 1.7 }}>
        All findings describe <span style={{ color: '#fff' }}>statistical associations</span> in this dataset.
        They suggest areas to investigate — not proven root causes.
        Controlled trials and engineering expertise are required to establish causality.
      </p>

      {loading && <LoadingOverlay message="Generating insights…" />}
      {error   && <Alert variant="error">{error}</Alert>}

      {data && (
        <>
          {/* Rate strip */}
          <div style={{ display: 'flex', gap: 'clamp(24px,4vw,56px)', flexWrap: 'wrap', borderBottom: '1px solid #111', paddingBottom: 40, marginBottom: 'clamp(48px,6vw,80px)' }}>
            <Stat value={`${(data.overall_defect_rate * 100).toFixed(2)}%`} label="Overall defect rate" accent={C.amber} />
            <Stat value={String(data.insights.length)} label="Insights generated" />
            <Stat value={String(data.action_plan.length)} label="Action items" />
          </div>

          {/* Insights — editorial numbered sections */}
          <div style={{ maxWidth: 800 }}>
            {data.insights.map((ins, idx) => (
              <InsightBlock key={ins.id} ins={ins} idx={idx} total={data.insights.length} />
            ))}
          </div>

          {/* Action plan */}
          <div style={{ marginTop: 'clamp(60px,7vw,100px)', borderTop: '1px solid #111', paddingTop: 60 }}>
            <p className="label-amber" style={{ marginBottom: 12 }}>Practical Action Plan</p>
            <p style={{ fontSize: 14, color: C.ash, fontWeight: 200, marginBottom: 32, maxWidth: 640 }}>
              Recommendations suggest investigations and trials.
              Do not set process limits without engineering specifications and controlled experiments.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table className="da-table">
                <thead>
                  <tr>
                    <th>Finding</th>
                    <th>Recommendation</th>
                    <th>Role</th>
                    <th>Priority</th>
                    <th>Metric to Monitor</th>
                    <th>Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {data.action_plan.map((ap, i) => (
                    <tr key={i}>
                      <td style={{ color: '#fff', maxWidth: 200 }}>{ap.finding}</td>
                      <td style={{ maxWidth: 260, lineHeight: 1.5 }}>{ap.recommendation}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{ap.responsible_role}</td>
                      <td>
                        <span style={{ color: PRIORITY_ACCENT[ap.priority] ?? C.ash, fontSize: 12, fontWeight: 600, letterSpacing: '0.02em' }}>
                          {ap.priority.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ maxWidth: 180 }}>{ap.metric_to_monitor}</td>
                      <td style={{ maxWidth: 200 }}>{ap.validation_method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Shell>
  )
}

function InsightBlock({ ins, idx, total }: { ins: Insight; idx: number; total: number }) {
  const num = String(ins.id).padStart(2, '0')
  const isLast = idx === total - 1

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr', gap: 24, marginBottom: isLast ? 0 : 'clamp(40px,5vw,64px)', paddingBottom: isLast ? 0 : 'clamp(40px,5vw,64px)', borderBottom: isLast ? 'none' : '1px solid #0d0d0d' }}>

      {/* Number */}
      <div>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.amber, letterSpacing: '0.025em', fontVariantNumeric: 'tabular-nums' }}>
          {num}
        </span>
      </div>

      {/* Content */}
      <div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.ash, letterSpacing: '0.025em', textTransform: 'uppercase' }}>
            {ins.category.replace(/_/g, ' ')}
          </span>
        </div>

        <h3 style={{ fontSize: 'clamp(18px,2vw,24px)', fontWeight: 400, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.25, marginBottom: 16 }}>
          {ins.title}
        </h3>

        <p style={{ fontSize: 16, fontWeight: 200, color: C.silver, lineHeight: 1.65, marginBottom: 20 }}>
          {ins.text}
        </p>

        {/* Supporting numbers */}
        {Object.keys(ins.supporting_numbers).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {Object.entries(ins.supporting_numbers).slice(0, 6).map(([k, v]) => (
              <span key={k} style={{ fontSize: 11, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 6, padding: '4px 10px', color: C.ash }}>
                <span style={{ color: '#fff', fontWeight: 400 }}>{k.replace(/_/g, ' ')}: </span>
                {typeof v === 'number'
                  ? (v > 0 && v < 1 ? `${(v * 100).toFixed(2)}%` : v.toLocaleString())
                  : String(v)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <div>
      <div style={{ fontSize: 'clamp(28px,3vw,42px)', fontWeight: 400, color: accent ?? '#fff', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 11, color: C.ash, textTransform: 'uppercase', letterSpacing: '0.025em', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function Shell({ pid, hasData, children }: { pid: string | null; hasData?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ background: '#000', minHeight: '100vh', paddingBottom: 120 }}>
      <div className="section-inner" style={{ paddingTop: 'clamp(48px,6vw,96px)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, marginBottom: 'clamp(24px,3vw,40px)' }}>
          <h1 className="page-heading">Turn findings into improvements.</h1>
          {pid && hasData && (
            <a href={dlHTMLReport(pid)} className="btn-primary">
              Download HTML Report
            </a>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}
