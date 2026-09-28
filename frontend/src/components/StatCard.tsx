// Unboxed metric display — large number + label, floating on void
interface Props {
  label: string
  value: string | number
  sub?: string
  accent?: 'iris' | 'amber' | 'teal' | 'default'
}

const accentColors: Record<string, string> = {
  iris:    '#8052ff',
  amber:   '#ffb829',
  teal:    '#15846e',
  default: '#ffffff',
}

export function StatCard({ label, value, sub, accent = 'default' }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="metric-value" style={{ color: accentColors[accent] }}>{value}</div>
      <div className="metric-label">{label}</div>
      {sub && <div className="caption">{sub}</div>}
    </div>
  )
}
