import { useRef } from 'react'
import { Button } from '../ui/Button'

/**
 * Flujo por pasos: indicador numerado (cada número lleva directo a su paso) y
 * botones Anterior / Siguiente. Todos los pasos quedan montados y solo se oculta
 * el que no está activo, así no se pierde lo cargado al ir y venir.
 *
 * steps: [{ id, label, done, error, narrow, content }] · controlado con current / onChange.
 */
export function Wizard({ steps, current, onChange }) {
  const top = useRef(null)
  const last = steps.length - 1

  const goTo = (index) => {
    if (index < 0 || index > last || index === current) return
    onChange(index)
    top.current?.scrollIntoView?.({ block: 'start' })
  }

  return (
    <div className="wizard" ref={top}>
      <nav aria-label="Pasos">
        <ol className="process">
          {steps.map((step, index) => {
            const state = step.error ? 'error' : step.done ? 'done' : 'todo'
            return (
              <li key={step.id}>
                <button
                  type="button"
                  className={`process__step is-${state} ${index === current ? 'is-current' : ''}`}
                  aria-current={index === current ? 'step' : undefined}
                  aria-label={`Paso ${index + 1}: ${step.label}${step.done ? ' (completo)' : step.error ? ' (con errores)' : ''}`}
                  onClick={() => goTo(index)}
                >
                  <span className="process__dot" aria-hidden="true">
                    {step.error ? '!' : step.done ? '✓' : index + 1}
                  </span>
                  <span className="process__label">{step.label}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      {steps.map((step, index) => (
        <section
          key={step.id}
          className={`wizard__panel ${step.narrow ? 'wizard__panel--narrow' : ''}`}
          hidden={index !== current}
          aria-label={`Paso ${index + 1}: ${step.label}`}
        >
          {step.content}
        </section>
      ))}

      <div className="step-nav">
        <Button onClick={() => goTo(current - 1)} disabled={current === 0}>
          ‹ Anterior
        </Button>
        <span className="muted small">
          Paso {current + 1} de {steps.length} · {steps[current].label}
        </span>
        <Button variant="primary" onClick={() => goTo(current + 1)} disabled={current === last}>
          Siguiente ›
        </Button>
      </div>
    </div>
  )
}
