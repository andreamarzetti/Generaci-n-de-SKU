/** `info`: ícono (i) de referencia de la sección; queda siempre en la esquina del encabezado. */
export function Card({ title, aside, info, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || aside || info) && (
        <header className="card__header">
          {title && <h2 className="card__title">{title}</h2>}
          {(aside || info) && (
            <div className="card__aside">
              {aside}
              {info}
            </div>
          )}
        </header>
      )}
      {children}
    </section>
  )
}
