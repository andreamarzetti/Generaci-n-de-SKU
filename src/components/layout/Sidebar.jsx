import logoBlanco from '../../assets/brand/Logo_2026_blanco_Servicom.png'

const VIEWS = [
  { id: 'generador', label: 'Generación de SKU' },
  { id: 'referencias', label: 'Altas de referencia' },
]

export function Sidebar({ view = 'generador', onNavigate = () => {}, pendingAltas = 0 }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__logo">
          <img src={logoBlanco} alt="Servicom Global" />
        </span>
        <span className="sidebar__app">Altas de SKU</span>
      </div>
      <nav className="sidebar__nav" aria-label="Principal">
        {VIEWS.map((item) => (
          <a
            key={item.id}
            className={`sidebar__link ${view === item.id ? 'is-active' : ''}`}
            href="#"
            aria-current={view === item.id ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault()
              onNavigate(item.id)
            }}
          >
            {item.label}
            {item.id === 'referencias' && pendingAltas > 0 && <span className="sidebar__count">{pendingAltas}</span>}
          </a>
        ))}
      </nav>
      <div className="sidebar__footer">
        <span className="sidebar__env">Datos mock</span>
        <span>Sin conexión a Tango</span>
      </div>
    </aside>
  )
}
