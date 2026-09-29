export function Field({ label, htmlFor, hint, error, counter, children }) {
  return (
    <div className="field">
      <div className="field__top">
        <label className="field__label" htmlFor={htmlFor}>
          {label}
        </label>
        {counter}
      </div>
      {children}
      {error ? <p className="field__error">{error}</p> : hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  )
}
