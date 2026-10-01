import { useState } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { ReferencesPage } from './pages/ReferencesPage'
import { SkuGeneratorPage } from './pages/SkuGeneratorPage'
import { ALTA_STATUS } from './reference/store'
import { useAltas } from './reference/useAltas'

export default function App() {
  const [view, setView] = useState('generador')
  const altas = useAltas()
  const pending = altas.filter((alta) => alta.status === ALTA_STATUS.PENDING).length

  // Las dos vistas quedan montadas: al volver al generador no se pierde lo que se estaba armando.
  return (
    <div className="app">
      <Sidebar view={view} onNavigate={setView} pendingAltas={pending} />
      <div className="view" hidden={view !== 'generador'}>
        <SkuGeneratorPage />
      </div>
      <div className="view" hidden={view !== 'referencias'}>
        <ReferencesPage />
      </div>
    </div>
  )
}
