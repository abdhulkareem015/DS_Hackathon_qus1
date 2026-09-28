import type { FilterOptions, Filters } from '../types'

interface Props {
  options: FilterOptions | null
  filters: Filters
  onChange: (f: Filters) => void
}

export function FilterBar({ options, filters, onChange }: Props) {
  if (!options) return null

  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    onChange({ ...filters, [key]: e.target.value })

  const hasActive = Object.values(filters).some(v => v)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '24px', marginBottom: '48px' }}>
      <span style={{ color: '#9a9a9a', fontSize: 12, fontWeight: 600, letterSpacing: '0.025em', textTransform: 'uppercase' }}>
        Filter
      </span>

      {[
        { key: 'machine_id'          as keyof Filters, label: 'Machine',          opts: options.machine_ids },
        { key: 'batch_id'            as keyof Filters, label: 'Batch',             opts: options.batch_ids },
        { key: 'raw_material_batch'  as keyof Filters, label: 'Raw Material',      opts: options.raw_material_batches },
        { key: 'operator_shift'      as keyof Filters, label: 'Shift',             opts: options.operator_shifts },
      ].map(({ key, label, opts }) => (
        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: '#9a9a9a', fontWeight: 600, letterSpacing: '0.025em', textTransform: 'uppercase' }}>
            {label}
          </label>
          <select
            value={filters[key]}
            onChange={set(key)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid #333',
              color: filters[key] ? '#fff' : '#9a9a9a',
              fontSize: 14,
              padding: '4px 0',
              outline: 'none',
              cursor: 'pointer',
              minWidth: 100,
            }}
          >
            <option value="" style={{ background: '#111' }}>All</option>
            {opts.map(o => <option key={o} value={o} style={{ background: '#111' }}>{o}</option>)}
          </select>
        </div>
      ))}

      {hasActive && (
        <button
          onClick={() => onChange({ machine_id: '', batch_id: '', raw_material_batch: '', operator_shift: '' })}
          style={{ color: '#9a9a9a', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
        >
          Clear
        </button>
      )}

      <p style={{ color: '#333', fontSize: 11, marginLeft: 'auto', fontWeight: 200 }}>
        Filters apply to analysis only — model training always uses the full dataset.
      </p>
    </div>
  )
}
