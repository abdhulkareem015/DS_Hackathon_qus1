import type { ReactNode } from 'react'

type Variant = 'info' | 'success' | 'warning' | 'error'

const styles: Record<Variant, string> = {
  info:    'da-alert da-alert-iris',
  success: 'da-alert da-alert-iris',
  warning: 'da-alert da-alert-amber',
  error:   'da-alert da-alert-red',
}

export function Alert({ variant = 'info', children }: { variant?: Variant; children: ReactNode }) {
  return <div className={styles[variant]}>{children}</div>
}
