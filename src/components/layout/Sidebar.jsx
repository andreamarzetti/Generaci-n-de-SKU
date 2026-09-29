import logoBlanco from '../../assets/brand/Logo_2026_blanco_Servicom.png'

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__logo">
          <img src={logoBlanco} alt="Servicom Global" />
        </span>
        <span className="sidebar__app">Altas de SKU</span>
      </div>
      <nav className="sidebar__nav" aria-label="Principal">
        <a className="sidebar__link is-active" href="#" aria-current="page">
          Generación de SKU
        </a>
      </nav>
      <div className="sidebar__footer">
        <span className="sidebar__env">Datos mock</span>
        <span>Sin conexión a Tango</span>
      </div>
    </aside>
  )
}
