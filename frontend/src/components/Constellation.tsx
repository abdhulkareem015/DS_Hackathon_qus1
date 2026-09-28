import { useEffect, useRef } from 'react'

interface Particle {
  x: number; y: number
  vx: number; vy: number
  size: number
  color: string
  opacity: number
  ambient: boolean
}

const COLORS = [
  '#8052ff','#8052ff','#8052ff',   // violet — most common
  '#ffb829','#ffb829',             // amber
  '#15846e',                       // teal
  '#e040fb',                       // magenta
  '#448aff',                       // blue
  '#ff4081',                       // pink accent
]

function brainShape(t: number): [number, number] {
  // Parametric brain silhouette approximation
  const x = 0.9 * Math.cos(t) - 0.3 * Math.cos(3 * t) + 0.1 * Math.sin(2 * t)
  const y = -(0.85 * Math.sin(t) + 0.15 * Math.sin(2 * t) + 0.05 * Math.cos(3 * t))
  return [x, y]
}

function makeParticles(W: number, H: number, isMobile: boolean): Particle[] {
  const cx = W / 2, cy = H / 2
  const rx = Math.min(W, H) * (isMobile ? 0.36 : 0.40)
  const ry = Math.min(W, H) * (isMobile ? 0.32 : 0.36)
  const N_brain = isMobile ? 280 : 520
  const N_ambient = isMobile ? 40 : 90
  const particles: Particle[] = []

  for (let i = 0; i < N_brain; i++) {
    const t = (i / N_brain) * Math.PI * 2 * 3 + Math.random() * 0.4
    const [nx, ny] = brainShape(t)
    const jitter = (Math.random() - 0.5) * 0.22
    const px = cx + (nx + jitter) * rx
    const py = cy + (ny + (Math.random() - 0.5) * 0.18) * ry
    particles.push({
      x: px, y: py,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      size: Math.random() * 2.2 + 0.8,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      opacity: Math.random() * 0.55 + 0.35,
      ambient: false,
    })
  }

  // Ambient particles scattered outside the brain
  for (let i = 0; i < N_ambient; i++) {
    const angle = Math.random() * Math.PI * 2
    const dist = Math.random() * Math.min(W, H) * 0.48 + Math.min(W, H) * 0.44
    particles.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * 0.06,
      vy: (Math.random() - 0.5) * 0.06,
      size: Math.random() * 1.4 + 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      opacity: Math.random() * 0.25 + 0.08,
      ambient: true,
    })
  }

  return particles
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  size: number, angle: number,
  color: string, opacity: number
) {
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.strokeStyle = color
  ctx.lineWidth = 0.8
  ctx.beginPath()
  for (let i = 0; i < 3; i++) {
    const a = angle + (i * Math.PI * 2) / 3
    const px = x + Math.cos(a) * size
    const py = y + Math.sin(a) * size
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.stroke()
  ctx.restore()
}

export function Constellation({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const particles = useRef<Particle[]>([])
  const angles    = useRef<number[]>([])
  const reduced   = useRef(false)
  const hidden    = useRef(false)

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const isMobile = window.innerWidth < 768

    function resize() {
      if (!canvas) return
      canvas.width  = canvas.offsetWidth  * devicePixelRatio
      canvas.height = canvas.offsetHeight * devicePixelRatio
      ctx!.scale(devicePixelRatio, devicePixelRatio)
      particles.current = makeParticles(canvas.offsetWidth, canvas.offsetHeight, isMobile)
      angles.current = particles.current.map(() => Math.random() * Math.PI * 2)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    function handleVisibility() { hidden.current = document.hidden }
    document.addEventListener('visibilitychange', handleVisibility)

    let frame = 0
    function animate() {
      if (!canvas || !ctx) return
      if (hidden.current) { rafRef.current = requestAnimationFrame(animate); return }

      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)

      const W = canvas.offsetWidth, H = canvas.offsetHeight
      const ps = particles.current
      const as = angles.current

      for (let i = 0; i < ps.length; i++) {
        const p = ps[i]
        if (!reduced.current) {
          p.x += p.vx
          p.y += p.vy
          as[i] += 0.004

          // Soft boundary repulsion
          if (p.x < 20)  p.vx += 0.02
          if (p.x > W-20) p.vx -= 0.02
          if (p.y < 20)  p.vy += 0.02
          if (p.y > H-20) p.vy -= 0.02
          p.vx *= 0.998
          p.vy *= 0.998
        }

        const flickerOpacity = p.opacity + Math.sin(frame * 0.03 + i * 0.7) * 0.08
        drawTriangle(ctx, p.x, p.y, p.size * (isMobile ? 1.1 : 1), as[i], p.color, Math.max(0.05, flickerOpacity))
      }

      frame++
      rafRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`block w-full h-full ${className}`}
      style={{ pointerEvents: 'none' }}
    />
  )
}
