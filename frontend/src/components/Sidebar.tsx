import { NavLink } from 'react-router-dom'
import {
  Upload, BarChart2, Brain, Zap, Lightbulb, Activity
} from 'lucide-react'
import { useApp } from '../context'

const links = [
  { to: '/',           label: 'Upload & Data Quality', Icon: Upload },
  { to: '/analysis',   label: 'Manufacturing Analysis', Icon: BarChart2 },
  { to: '/training',   label: 'Model Training',         Icon: Brain },
  { to: '/predict',    label: 'Predict Defect',         Icon: Zap },
  { to: '/insights',   label: 'Insights & Action Plan', Icon: Lightbulb },
]

export function Sidebar() {
  const { project } = useApp()
  const hasData = !!project.projectId

  return (
    <aside className="w-64 min-h-screen bg-brand-900 text-white flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-brand-800">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-6 h-6 text-brand-300" />
          <span className="font-bold text-lg leading-tight">Defect Analyzer</span>
        </div>
        <p className="text-brand-400 text-xs">Electronics Manufacturing</p>
      </div>

      {/* Project badge */}
      {project.filename && (
        <div className="mx-4 mt-4 px-3 py-2 bg-brand-800 rounded-lg">
          <p className="text-xs text-brand-400 mb-0.5">Active dataset</p>
          <p className="text-xs text-white truncate">{project.filename}</p>
          {project.validationReport && (
            <p className="text-xs text-brand-300 mt-1">
              {project.validationReport.usable_labeled_rows.toLocaleString()} records
            </p>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 mt-2">
        {links.map(({ to, label, Icon }) => {
          const locked = to !== '/' && !hasData
          return (
            <NavLink
              key={to}
              to={locked ? '/' : to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                ${locked ? 'opacity-40 cursor-not-allowed' : ''}
                ${isActive && !locked
                  ? 'bg-brand-600 text-white font-medium'
                  : 'text-brand-300 hover:bg-brand-800 hover:text-white'}`
              }
              onClick={e => locked && e.preventDefault()}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
              {to === '/training' && project.trainingStatus === 'completed' && (
                <span className="ml-auto w-2 h-2 bg-green-400 rounded-full" />
              )}
              {to === '/training' && project.trainingStatus === 'running' && (
                <span className="ml-auto w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="p-4 border-t border-brand-800">
        <p className="text-xs text-brand-500 leading-relaxed">
          Student project — findings are associations, not proven root causes.
        </p>
      </div>
    </aside>
  )
}
