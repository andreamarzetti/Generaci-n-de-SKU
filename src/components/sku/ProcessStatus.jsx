/** Indicador del estado del proceso. No es un wizard: todo sucede en la misma pantalla. */
export function ProcessStatus({ steps }) {
  return (
    <ol className="process" aria-label="Estado del proceso">
      {steps.map((step, index) => (
        <li key={step.id} className={`process__step is-${step.state}`}>
          <span className="process__dot" aria-hidden="true">
            {step.state === 'done' ? '✓' : step.state === 'error' ? '!' : index + 1}
          </span>
          <span className="process__label">{step.label}</span>
        </li>
      ))}
    </ol>
  )
}
