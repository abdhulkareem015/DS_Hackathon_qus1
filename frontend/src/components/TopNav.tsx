import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useApp } from '../context'

const LINKS = [
  { to: '/',          label: 'Overview' },
  { to: '/dataset',   label: 'Dataset'  },
  { to: '/analysis',  label: 'Analysis' },
  { to: '/model',     label: 'Model'    },
  { to: '/predict',   label: 'Predict'  },
  { to: '/insights',  label: 'Insights' },
]

export function TopNav() {
  const { project } = useApp()
  const hasData = !!project.projectId
  const [open, setOpen] = useState(false)

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    >
      <div className="section-inner">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2.5 no-underline">
            {/* Geometric mark */}
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <polygon points="11,1 21,20 1,20" stroke="#8052ff" strokeWidth="1.5" fill="none"/>
              <polygon points="11,6 17,18 5,18" stroke="#15846e" strokeWidth="1" fill="none" opacity="0.6"/>
            </svg>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#ffffff', letterSpacing: '0.01em' }}>
              Defect Analyzer
            </span>
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-7">
            {LINKS.map(({ to, label }) => {
              const locked = to !== '/' && !hasData
              return (
                <NavLink
                  key={to}
                  to={locked ? '/' : to}
                  onClick={e => locked && e.preventDefault()}
                  className={({ isActive }) =>
                    `label-gray transition-colors no-underline
                    ${isActive && !locked ? '!text-white' : ''}
                    ${locked ? 'opacity-30 cursor-not-allowed' : 'hover:!text-white'}`
                  }
                  style={{ letterSpacing: '0.025em', textTransform: 'uppercase', fontSize: 13 }}
                >
                  {label}
                </NavLink>
              )
            })}
          </nav>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2"
            style={{ color: '#9a9a9a', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => setOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {open ? <X size={20}/> : <Menu size={20}/>}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden" style={{ background: '#000', borderTop: '1px solid #111' }}>
          <div className="section-inner py-4 flex flex-col gap-4">
            {LINKS.map(({ to, label }) => {
              const locked = to !== '/' && !hasData
              return (
                <NavLink
                  key={to}
                  to={locked ? '/' : to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `label-gray no-underline ${isActive ? '!text-white' : ''} ${locked ? 'opacity-30' : ''}`
                  }
                >
                  {label}
                </NavLink>
              )
            })}
          </div>
        </div>
      )}
    </header>
  )
}
