import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useApp } from '../context'
import { getSummary } from '../api'
import { Constellation } from '../components/Constellation'
import { Spinner } from '../components/Spinner'

interface Summary { inspected: number; defective: number; defect_rate: number; machines: number; batches: number }

export function OverviewPage() {
  const { project } = useApp()
  const navigate = useNavigate()
  const pid = project.projectId
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => {
    if (!pid) return
    getSummary(pid, {}).then(r => setSummary(r.data)).catch(() => {})
  }, [pid])

  return (
    <div style={{ background: '#000', minHeight: '100vh' }}>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section style={{ minHeight: '90vh', display: 'flex', alignItems: 'center' }}>
        <div className="section-inner" style={{ width: '100%', paddingTop: 48, paddingBottom: 48 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
            gap: 'clamp(32px, 4vw, 80px)',
            alignItems: 'center',
          }}
            className="hero-grid"
          >
            {/* Left */}
            <div>
              <p className="label-amber" style={{ marginBottom: 24 }}>
                Electronics Manufacturing Intelligence
              </p>

              <h1 className="display-heading" style={{ marginBottom: 32 }}>
                Understand<br />defects.<br />Improve<br />production.
              </h1>

              <p className="body-muted" style={{ maxWidth: 480, marginBottom: 40 }}>
                Explore production conditions, uncover defect patterns, and predict
                inspection outcomes with Random Forest.
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 24 }}>
                <button
                  className="btn-primary"
                  onClick={() => navigate('/dataset')}
                >
                  Upload Dataset
                </button>
                {pid && (
                  <button
                    className="btn-ghost"
                    onClick={() => navigate('/analysis')}
                  >
                    Explore analysis <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Right — constellation */}
            <div
              aria-hidden="true"
              style={{
                height: 'clamp(320px, 45vw, 580px)',
                position: 'relative',
              }}
            >
              <Constellation className="absolute inset-0 w-full h-full" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Metric strip ──────────────────────────────────────── */}
      <section style={{ borderTop: '1px solid #111', paddingBottom: 'clamp(60px, 8vw, 120px)' }}>
        <div className="section-inner" style={{ paddingTop: 'clamp(48px, 6vw, 80px)' }}>

          {!pid && (
            <div style={{ textAlign: 'center', paddingBottom: 48 }}>
              <p className="label-amber" style={{ marginBottom: 16 }}>Dataset metrics</p>
              <p className="body-muted">Upload a dataset to see production metrics here.</p>
            </div>
          )}

          {pid && !summary && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Spinner size="md" />
            </div>
          )}

          {summary && (
            <>
              <p className="label-amber" style={{ marginBottom: 40 }}>
                {project.filename ?? 'Dataset'} — production metrics
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 'clamp(24px, 4vw, 60px)',
              }}>
                <Metric value={summary.inspected.toLocaleString()}              label="Inspected Records" />
                <Metric value={summary.defective.toLocaleString()}              label="Defective Records" accent="#ffb829" />
                <Metric value={`${(summary.defect_rate*100).toFixed(2)}%`}      label="Defect Rate"       accent="#8052ff" />
                <Metric value={summary.machines.toString()}                     label="Machines" />
                <Metric value={summary.batches.toLocaleString()}                label="Production Batches" />
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Feature strip ──────────────────────────────────────── */}
      <section style={{ paddingBottom: 'clamp(60px, 8vw, 120px)' }}>
        <div className="section-inner">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'clamp(32px, 4vw, 60px)',
          }}>
            {FEATURES.map(f => (
              <div key={f.title}>
                <p className="label-amber" style={{ marginBottom: 12 }}>{f.step}</p>
                <h3 style={{ fontSize: 24, fontWeight: 400, color: '#fff', marginBottom: 12, letterSpacing: '-0.02em' }}>{f.title}</h3>
                <p style={{ fontSize: 15, fontWeight: 200, color: '#9a9a9a', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Responsive hero grid collapse */}
      <style>{`
        @media (max-width: 767px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-grid > *:last-child { height: 260px !important; }
        }
      `}</style>
    </div>
  )
}

function Metric({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <div>
      <div className="metric-value" style={accent ? { color: accent } : {}}>{value}</div>
      <div className="metric-label">{label}</div>
    </div>
  )
}

const FEATURES = [
  { step: '01', title: 'Upload & Validate',   desc: 'Load production CSV data. Automatic validation, missing-value detection, and duplicate flagging.' },
  { step: '02', title: 'Explore Patterns',    desc: 'Defect rates by machine, batch, shift, and material. Four analytical charts with live filters.' },
  { step: '03', title: 'Train a Classifier',  desc: 'Batch-aware Random Forest with held-out evaluation, feature importance, and baseline comparison.' },
  { step: '04', title: 'Predict & Improve',   desc: 'Enter production parameters to estimate defect risk. Generate evidence-based action plans.' },
]
