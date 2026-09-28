import React, { createContext, useContext, useState, ReactNode } from 'react'
import type { ProjectState, ValidationReport, Filters } from './types'

interface AppContextType {
  project: ProjectState
  setProject: React.Dispatch<React.SetStateAction<ProjectState>>
  filters: Filters
  setFilters: React.Dispatch<React.SetStateAction<Filters>>
}

const AppContext = createContext<AppContextType | null>(null)

const DEFAULT_PROJECT: ProjectState = {
  projectId: null,
  filename: null,
  validationReport: null,
  trainingStatus: 'not_started',
}

const DEFAULT_FILTERS: Filters = {
  machine_id: '',
  batch_id: '',
  raw_material_batch: '',
  operator_shift: '',
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<ProjectState>(DEFAULT_PROJECT)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  return (
    <AppContext.Provider value={{ project, setProject, filters, setFilters }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}
