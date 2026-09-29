import { Sidebar } from './components/layout/Sidebar'
import { SkuGeneratorPage } from './pages/SkuGeneratorPage'

export default function App() {
  return (
    <div className="app">
      <Sidebar />
      <SkuGeneratorPage />
    </div>
  )
}
