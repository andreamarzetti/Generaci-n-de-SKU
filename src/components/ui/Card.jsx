export function Card({ title, aside, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || aside) && (
        <header className="card__header">
          {title && <h2 className="card__title">{title}</h2>}
          {aside && <div className="card__aside">{aside}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
