import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, ScatterChart, Scatter
} from 'recharts'
import { useApp } from '../context'
import { getFilterOptions, getSummary, getDefectRates, getMachineChart, getRMChart, getScatter, getHeatmap, getHighRisk } from '../api'
import { FilterBar } from '../components/FilterBar'
import { DataTable, fmtPct, fmtN } from '../components/DataTable'
import { LoadingOverlay } from '../components/Spinner'
import { Alert } from '../components/Alert'
import type { FilterOptions, SummaryStats, DefectRateRow, HeatmapCell, HighRiskRow } from '../types'

// Design token colors
const C_IRIS    = '#8052ff'
const C_AMBER   = '#ffb829'
const C_TEAL    = '#15846e'
const C_ASH     = '#9a9a9a'
const C_SILVER  = '#bdbdbd'
const C_VOID    = '#000000'
const AXIS_STYLE = { fill: C_ASH, fontSize: 11, fontWeight: 400 }
const GRID_STROKE = '#111111'
const NUM_COLS  = ['Temperature', 'Pressure', 'Machine_Speed']

const TT_STYLE: React.CSSProperties = {
  background: '#0a0a0a', border: '1px solid #222', borderRadius: 8,
  padding: '10px 14px', fontSize: 12, color: C_SILVER,
}

export function AnalysisPage() {
  const { project, filters, setFilters } = useApp()
  const pid = project.projectId!

  const [filterOpts, setFilterOpts] = useState<FilterOptions | null>(null)
  const [summary,    setSummary]    = useState<SummaryStats | null>(null)
  const [rates,      setRates]      = useState<{ by_machine: DefectRateRow[]; by_batch: DefectRateRow[]; by_raw_material: DefectRateRow[]; by_shift: DefectRateRow[]; overall_rate: number } | null>(null)
  const [machChart,  setMachChart]  = useState<{ data: DefectRateRow[]; overall_rate: number } | null>(null)
  const [rmChart,    setRmChart]    = useState<{ data: DefectRateRow[]; overall_rate: number } | null>(null)
  const [scatter,    setScatter]    = useState<{ points: Record<string,number>[]; x_col: string; y_col: string; sampled: boolean } | null>(null)
  const [xCol, setXCol] = useState('Temperature')
  const [yCol, setYCol] = useState('Pressure')
  const [heatmap,    setHeatmap]    = useState<{ cells: HeatmapCell[] } | null>(null)
  const [highRisk,   setHighRisk]   = useState<{ combinations: Record<string,HighRiskRow[]>; overall_defect_rate: number; min_support: number } | null>(null)
  const [minSupport, setMinSupport] = useState(20)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    getFilterOptions(pid).then(r => setFilterOpts(r.data)).catch(() => {})
  }, [pid])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [sumR, ratesR, mcR, rmR, scR, hmR, hrR] = await Promise.all([
        getSummary(pid, filters), getDefectRates(pid, filters),
        getMachineChart(pid, filters), getRMChart(pid, filters),
        getScatter(pid, xCol, yCol, filters), getHeatmap(pid, filters),
        getHighRisk(pid, minSupport, filters),
      ])
      setSummary(sumR.data); setRates(ratesR.data)
      setMachChart(mcR.data); setRmChart(rmR.data)
      setScatter(scR.data); setHeatmap(hmR.data); setHighRisk(hrR.data)
    } catch (e: unknown) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to load analysis.')
    } finally { setLoading(false) }
  }, [pid, filters, xCol, yCol, minSupport])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!summary) return
    getScatter(pid, xCol, yCol, filters).then(r => setScatter(r.data)).catch(() => {})
  }, [xCol, yCol])

  if (!pid) return (
    <PageShell title="See where defects concentrate.">
      <Alert variant="warning">Upload a dataset on the Dataset page first.</Alert>
    </PageShell>
  )

  return (
    <PageShell title="See where defects concentrate.">

      {/* Filters */}
      <FilterBar options={filterOpts} filters={filters} onChange={setFilters} />

      {loading && <LoadingOverlay message="Loading analysis…" />}
      {error   && <Alert variant="error">{error}</Alert>}

      {summary && (
        <>
          {/* Metric strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 'clamp(20px,3vw,48px)', marginBottom: 'clamp(60px,7vw,100px)' }}>
            <M value={fmtN(summary.inspected)}             label="Inspected" />
            <M value={fmtN(summary.defective)}             label="Defective"        accent={C_AMBER} />
            <M value={fmtPct(summary.defect_rate)}         label="Defect Rate"      accent={C_IRIS}  />
            <M value={String(summary.machines)}            label="Machines" />
            <M value={String(summary.batches)}             label="Batches" />
            <M value={String(summary.raw_material_batches)} label="RM Batches" />
            <M value={String(summary.shifts)}              label="Shifts" />
          </div>

          {/* ── CHART 1 — Machine defect rate ── */}
          <ChartSection
            label="01"
            title="Defect Rate by Machine"
            note="Amber baseline = overall rate. Violet = above baseline."
          >
            {machChart && machChart.data.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={machChart.data} margin={{ top: 8, right: 20, bottom: 8, left: 0 }}>
                  <XAxis dataKey="Machine_ID" tick={AXIS_STYLE} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
                  <YAxis tickFormatter={v => `${(v*100).toFixed(0)}%`} tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                  <Tooltip content={<MachineTT overall={machChart.overall_rate} />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <ReferenceLine y={machChart.overall_rate} stroke={C_AMBER} strokeDasharray="4 3" strokeWidth={1} />
                  <Bar dataKey="defect_rate" radius={[3,3,0,0]}>
                    {machChart.data.map((row, i) => (
                      <Cell key={i} fill={row.defect_rate > machChart.overall_rate ? C_IRIS : '#2a2a2a'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </ChartSection>

          {/* ── CHART 2 — Raw-material batch ── */}
          <ChartSection
            label="02"
            title="Defect Rate by Raw-Material Batch"
            note="Amber baseline = overall rate. Gray bars = small sample (<20). Teal = below baseline."
          >
            {rmChart && rmChart.data.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={rmChart.data} margin={{ top: 8, right: 20, bottom: 48, left: 0 }}>
                  <XAxis dataKey="Raw_Material_Batch" tick={{ ...AXIS_STYLE, fontSize: 10 }} angle={-35} textAnchor="end" interval={0} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
                  <YAxis tickFormatter={v => `${(v*100).toFixed(0)}%`} tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                  <Tooltip content={<RMTTooltip overall={rmChart.overall_rate} />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <ReferenceLine y={rmChart.overall_rate} stroke={C_AMBER} strokeDasharray="4 3" strokeWidth={1} />
                  <Bar dataKey="defect_rate" radius={[3,3,0,0]}>
                    {rmChart.data.map((row, i) => (
                      <Cell key={i}
                        fill={row.small_sample ? '#1a1a1a' : row.defect_rate > rmChart.overall_rate ? C_IRIS : C_TEAL}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </ChartSection>

          {/* ── CHART 3 — Scatter ── */}
          <ChartSection
            label="03"
            title="Numeric Conditions vs Defect Status"
            note="Violet = defective. Teal = non-defective. Transparency applied."
          >
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
              {(['X','Y'] as const).map((axis, ai) => {
                const val = ai === 0 ? xCol : yCol
                const setter = ai === 0 ? setXCol : setYCol
                return (
                  <div key={axis} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: C_ASH, fontSize: 12, fontWeight: 600, letterSpacing: '0.025em', textTransform: 'uppercase' }}>{axis}</span>
                    <select value={val} onChange={e => setter(e.target.value)}
                      style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #333', color: '#fff', fontSize: 13, padding: '4px 0', outline: 'none', cursor: 'pointer' }}>
                      {NUM_COLS.map(c => <option key={c} style={{ background: '#111' }}>{c}</option>)}
                    </select>
                  </div>
                )
              })}
            </div>
            {scatter && scatter.points.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={320}>
                  <ScatterChart margin={{ top: 8, right: 20, bottom: 8, left: 0 }}>
                    <XAxis dataKey={xCol} name={xCol} tick={AXIS_STYLE} axisLine={{ stroke: GRID_STROKE }} tickLine={false}
                      label={{ value: xCol, position: 'insideBottom', offset: -2, fill: C_ASH, fontSize: 11 }} />
                    <YAxis dataKey={yCol} name={yCol} tick={AXIS_STYLE} axisLine={false} tickLine={false}
                      label={{ value: yCol, angle: -90, position: 'insideLeft', fill: C_ASH, fontSize: 11 }} />
                    <Tooltip cursor={{ strokeDasharray: '3 3', stroke: '#333' }} content={<ScatterTT xCol={xCol} yCol={yCol} />} />
                    <Scatter data={scatter.points.filter(p => p.defect === 0)} fill={C_TEAL} fillOpacity={0.35} name="Non-Defective" />
                    <Scatter data={scatter.points.filter(p => p.defect === 1)} fill={C_IRIS} fillOpacity={0.55} name="Defective" />
                  </ScatterChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
                  <LegendDot color={C_IRIS}  label="Defective" />
                  <LegendDot color={C_TEAL}  label="Non-Defective" />
                  {scatter.sampled && <span style={{ fontSize: 12, color: C_AMBER, fontWeight: 200 }}>⚠ Sample of 2,000 points plotted — full dataset used for statistics.</span>}
                </div>
              </>
            ) : <EmptyChart />}
          </ChartSection>

          {/* ── CHART 4 — Heatmap ── */}
          <ChartSection
            label="04"
            title="Temperature Band × Machine-Speed Band"
            note="Cells with <20 records shown at reduced opacity — interpret with caution."
          >
            {heatmap && heatmap.cells.length > 0
              ? <HeatmapGrid cells={heatmap.cells} />
              : <EmptyChart />}
          </ChartSection>

          {/* ── Rate tables ── */}
          <div style={{ marginTop: 'clamp(60px,7vw,100px)', borderTop: '1px solid #111', paddingTop: 60 }}>
            <p className="label-amber" style={{ marginBottom: 40 }}>Defect rate tables</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 'clamp(32px,4vw,60px)' }}>
              <RateSection title="By Machine"           rows={rates?.by_machine ?? []}            groupKey="Machine_ID" />
              <RateSection title="By Operator Shift"    rows={rates?.by_shift ?? []}              groupKey="Operator_Shift" />
              <RateSection title="By Raw Material Batch" rows={rates?.by_raw_material ?? []}      groupKey="Raw_Material_Batch" />
              <RateSection title="By Production Batch"  rows={(rates?.by_batch ?? []).slice(0,20)} groupKey="Batch_ID" />
            </div>
          </div>

          {/* ── High-risk combinations ── */}
          {highRisk && (
            <div style={{ marginTop: 'clamp(60px,7vw,100px)', borderTop: '1px solid #111', paddingTop: 60 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 24, marginBottom: 32 }}>
                <p className="label-amber">High-risk combinations</p>
                <span style={{ color: C_ASH, fontSize: 13, fontWeight: 200 }}>
                  Overall rate: {fmtPct(highRisk.overall_defect_rate)}
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: C_ASH }}>Min support</span>
                  <input type="number" min={5} max={500} value={minSupport}
                    onChange={e => setMinSupport(Number(e.target.value))}
                    onBlur={() => load()}
                    style={{ width: 60, background: 'transparent', border: 'none', borderBottom: '1px solid #333', color: '#fff', fontSize: 13, padding: '2px 0', outline: 'none', textAlign: 'center' }} />
                </div>
              </div>
              {Object.entries(highRisk.combinations).map(([combo, rows]) => (
                <div key={combo} style={{ marginBottom: 48 }}>
                  <p style={{ fontSize: 15, fontWeight: 400, color: '#fff', marginBottom: 16 }}>{combo}</p>
                  <HighRiskTable rows={rows} groupKeys={combo.split(' × ')} overall={highRisk.overall_defect_rate} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </PageShell>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C_VOID, minHeight: '100vh', paddingBottom: 120 }}>
      <div className="section-inner" style={{ paddingTop: 'clamp(48px,6vw,96px)' }}>
        <h1 className="page-heading" style={{ marginBottom: 'clamp(32px,4vw,56px)' }}>{title}</h1>
        {children}
      </div>
    </div>
  )
}

function ChartSection({ label, title, note, children }: { label: string; title: string; note: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 'clamp(60px,7vw,100px)', borderTop: '1px solid #111', paddingTop: 60 }}>
      <p className="label-amber" style={{ marginBottom: 12 }}>Chart {label}</p>
      <h2 style={{ fontSize: 'clamp(20px,2.5vw,28px)', fontWeight: 400, color: '#fff', marginBottom: 8, letterSpacing: '-0.02em' }}>{title}</h2>
      <p style={{ fontSize: 13, color: C_ASH, marginBottom: 32, fontWeight: 200 }}>{note}</p>
      {children}
    </div>
  )
}

function M({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <div>
      <div style={{ fontSize: 'clamp(22px,2.5vw,36px)', fontWeight: 400, color: accent ?? '#fff', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 11, color: C_ASH, textTransform: 'uppercase', letterSpacing: '0.025em', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function EmptyChart() {
  return <p style={{ color: '#333', fontSize: 14, textAlign: 'center', padding: '48px 0', fontWeight: 200 }}>No data available for current filters.</p>
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C_ASH }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </span>
  )
}

function RateSection({ title, rows, groupKey }: { title: string; rows: DefectRateRow[]; groupKey: string }) {
  return (
    <div>
      <p style={{ fontSize: 15, fontWeight: 400, color: '#fff', marginBottom: 16 }}>{title}</p>
      <DataTable
        data={rows}
        emptyMessage="No data"
        columns={[
          { key: groupKey, header: groupKey },
          { key: 'inspected', header: 'n', align: 'right', render: r => fmtN(r.inspected as number) },
          { key: 'defective', header: 'Defective', align: 'right', render: r => fmtN(r.defective as number) },
          { key: 'defect_rate', header: 'Rate', align: 'right', render: r => (
            <span style={{ color: (r.defect_rate as number) > 0.15 ? C_AMBER : C_SILVER }}>
              {fmtPct(r.defect_rate as number)}
            </span>
          )},
          { key: 'diff_from_overall', header: 'Δ', align: 'right', render: r => {
            const d = r.diff_from_overall as number
            return <span style={{ color: d > 0 ? C_IRIS : C_TEAL }}>{d > 0 ? '+' : ''}{fmtPct(d)}</span>
          }},
          { key: 'small_sample', header: '', render: r => r.small_sample ? <span className="badge-amber">small n</span> : null },
        ]}
      />
    </div>
  )
}

function HighRiskTable({ rows, groupKeys, overall }: { rows: HighRiskRow[]; groupKeys: string[]; overall: number }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="da-table">
        <thead>
          <tr>
            {groupKeys.map(k => <th key={k}>{k}</th>)}
            <th className="right">Inspected</th>
            <th className="right">Defective</th>
            <th className="right">Rate</th>
            <th className="right">Δ Overall</th>
            <th className="right">Lift</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ opacity: row.below_min_support ? 0.35 : 1 }}>
              {groupKeys.map(k => <td key={k} style={{ color: '#fff' }}>{String(row[k])}</td>)}
              <td className="right">{fmtN(row.inspected as number)}</td>
              <td className="right">{fmtN(row.defective as number)}</td>
              <td className="right" style={{ color: (row.defect_rate as number) > overall * 1.5 ? C_AMBER : C_SILVER }}>
                {fmtPct(row.defect_rate as number)}
              </td>
              <td className="right" style={{ color: (row.diff_from_overall as number) > 0 ? C_IRIS : C_TEAL }}>
                {(row.diff_from_overall as number) > 0 ? '+' : ''}{fmtPct(row.diff_from_overall as number)}
              </td>
              <td className="right">{row.lift != null ? `${(row.lift as number).toFixed(2)}×` : '—'}</td>
              <td>{row.below_min_support && <span className="badge-gray">low n</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function HeatmapGrid({ cells }: { cells: HeatmapCell[] }) {
  const tempBands  = [...new Set(cells.map(c => c.temp_band))].sort()
  const speedBands = [...new Set(cells.map(c => c.speed_band))].sort()
  const cellMap: Record<string, HeatmapCell> = {}
  cells.forEach(c => { cellMap[`${c.temp_band}||${c.speed_band}`] = c })
  const maxRate = Math.max(...cells.map(c => c.defect_rate), 0.001)

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 4, fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ color: C_ASH, fontWeight: 400, fontSize: 11, padding: '4px 8px', textAlign: 'left' }}>Temp \ Speed</th>
            {speedBands.map(s => <th key={s} style={{ color: C_ASH, fontSize: 11, fontWeight: 400, padding: '4px 8px', whiteSpace: 'nowrap' }}>{s}</th>)}
          </tr>
        </thead>
        <tbody>
          {tempBands.map(tb => (
            <tr key={tb}>
              <td style={{ color: C_ASH, fontSize: 11, padding: '4px 8px', whiteSpace: 'nowrap', fontWeight: 400 }}>{tb}</td>
              {speedBands.map(sb => {
                const cell = cellMap[`${tb}||${sb}`]
                if (!cell) return <td key={sb} style={{ padding: '4px 8px', textAlign: 'center', color: '#222' }}>—</td>
                const intensity = cell.defect_rate / maxRate
                const bg = `rgba(128,82,255,${(intensity * 0.75 + 0.08).toFixed(2)})`
                return (
                  <td key={sb} style={{ background: bg, opacity: cell.low_sample ? 0.45 : 1, borderRadius: 6, padding: '10px 12px', textAlign: 'center', minWidth: 90 }}>
                    <div style={{ fontWeight: 400, color: '#fff', fontSize: 13 }}>{(cell.defect_rate*100).toFixed(1)}%</div>
                    <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>n={cell.inspected}</div>
                    {cell.low_sample && <div style={{ color: C_AMBER, fontSize: 10 }}>⚠</div>}
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

// Tooltips
function MachineTT({ active, payload, overall }: { active?: boolean; payload?: { payload: DefectRateRow }[]; overall: number }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={TT_STYLE}>
      <p style={{ color: '#fff', fontWeight: 400, marginBottom: 6 }}>{d.Machine_ID as string}</p>
      <p>Inspected: <span style={{ color: '#fff' }}>{fmtN(d.inspected)}</span></p>
      <p>Defective: <span style={{ color: C_AMBER }}>{fmtN(d.defective)}</span></p>
      <p>Rate: <span style={{ color: '#fff' }}>{fmtPct(d.defect_rate)}</span></p>
      <p style={{ color: d.defect_rate > overall ? C_IRIS : C_TEAL }}>
        Δ Overall: {d.defect_rate > overall ? '+' : ''}{fmtPct(d.defect_rate - overall)}
      </p>
    </div>
  )
}

function RMTTooltip({ active, payload, overall }: { active?: boolean; payload?: { payload: DefectRateRow }[]; overall: number }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={TT_STYLE}>
      <p style={{ color: '#fff', fontWeight: 400, marginBottom: 6 }}>{d.Raw_Material_Batch as string}</p>
      <p>Inspected: <span style={{ color: '#fff' }}>{fmtN(d.inspected)}</span></p>
      <p>Rate: <span style={{ color: '#fff' }}>{fmtPct(d.defect_rate)}</span></p>
      <p style={{ color: d.defect_rate > overall ? C_IRIS : C_TEAL }}>
        Δ Overall: {d.defect_rate > overall ? '+' : ''}{fmtPct(d.defect_rate - overall)}
      </p>
      {d.small_sample && <p style={{ color: C_AMBER }}>⚠ Small sample</p>}
    </div>
  )
}

function ScatterTT({ active, payload, xCol, yCol }: { active?: boolean; payload?: { payload: Record<string,number> }[]; xCol: string; yCol: string }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={TT_STYLE}>
      <p style={{ color: d.defect === 1 ? C_IRIS : C_TEAL, fontWeight: 400, marginBottom: 6 }}>
        {d.defect === 1 ? 'Defective' : 'Non-Defective'}
      </p>
      <p>{xCol}: <span style={{ color: '#fff' }}>{d[xCol]?.toFixed(2)}</span></p>
      <p>{yCol}: <span style={{ color: '#fff' }}>{d[yCol]?.toFixed(2)}</span></p>
    </div>
  )
}
