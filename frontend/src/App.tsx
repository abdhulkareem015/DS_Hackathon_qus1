import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './context'
import { TopNav }      from './components/TopNav'
import { OverviewPage }  from './pages/OverviewPage'
import { DatasetPage }   from './pages/DatasetPage'
import { AnalysisPage }  from './pages/AnalysisPage'
import { TrainingPage }  from './pages/TrainingPage'
import { PredictPage }   from './pages/PredictPage'
import { InsightsPage }  from './pages/InsightsPage'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        {/* Keyframe for spinner */}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

        <TopNav />

        {/* Push content below fixed nav */}
        <main style={{ paddingTop: 64 }}>
          <Routes>
            <Route path="/"          element={<OverviewPage />} />
            <Route path="/dataset"   element={<DatasetPage />} />
            <Route path="/analysis"  element={<AnalysisPage />} />
            <Route path="/model"     element={<TrainingPage />} />
            <Route path="/predict"   element={<PredictPage />} />
            <Route path="/insights"  element={<InsightsPage />} />
          </Routes>
        </main>
      </BrowserRouter>
    </AppProvider>
  )
}
