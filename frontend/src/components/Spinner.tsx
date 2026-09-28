export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: '16px', md: '24px', lg: '40px' }[size]
  return (
    <span
      style={{
        display: 'inline-block',
        width: s, height: s,
        borderRadius: '50%',
        border: '2px solid rgba(128,82,255,0.3)',
        borderTopColor: '#8052ff',
        animation: 'spin 0.7s linear infinite',
      }}
    />
  )
}

export function LoadingOverlay({ message = 'Loading…' }: { message?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0', gap: 16 }}>
      <Spinner size="lg" />
      <p style={{ color: '#9a9a9a', fontSize: 14, fontWeight: 200 }}>{message}</p>
    </div>
  )
}
