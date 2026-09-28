import type { ReactNode } from 'react'

interface Column<T> {
  key: keyof T | string
  header: string
  render?: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
}

interface Props<T> {
  columns: Column<T>[]
  data: T[]
  emptyMessage?: string
  maxRows?: number
}

export function DataTable<T extends Record<string, unknown>>({
  columns, data, emptyMessage = 'No data', maxRows
}: Props<T>) {
  const rows = maxRows ? data.slice(0, maxRows) : data

  if (!data.length) {
    return <p style={{ color: '#9a9a9a', fontSize: 14, textAlign: 'center', padding: '32px 0', fontWeight: 200 }}>{emptyMessage}</p>
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="da-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={String(col.key)} className={col.align === 'right' ? 'right' : ''}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map(col => (
                <td key={String(col.key)} className={col.align === 'right' ? 'right' : ''}>
                  {col.render
                    ? col.render(row)
                    : String(row[col.key as keyof T] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {maxRows && data.length > maxRows && (
        <p style={{ color: '#9a9a9a', fontSize: 12, padding: '8px 12px' }}>
          Showing {maxRows} of {data.length} rows
        </p>
      )}
    </div>
  )
}

export const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`
export const fmtN   = (v: number) => v?.toLocaleString() ?? '—'
