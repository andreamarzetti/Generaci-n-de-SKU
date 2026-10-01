import { useRef, useState } from 'react'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

/**
 * Flujo por pasos: indicador numerado (cada número lleva directo a su paso) y
 * botones Anterior / Siguiente. Todos los pasos quedan montados y solo se oculta
 * el que no está activo, así no se pierde lo cargado al ir y venir.
 *
 * steps: [{ id, label, done, error, narrow, content }] · controlado con current / onChange.
 * guard(desde, hacia): si devuelve { message, actionLabel?, onAction? }, no se avanza y se explica
 * qué falta (con un botón para hacerlo, si corresponde). El aviso desaparece cuando ya no hace falta.
 */
export function Wizard({ steps, current, onChange, guard }) {
  const top = useRef(null)
  const last = steps.length - 1
  const [attempted, setAttempted] = useState(false)

  const goTo = (index) => {
    if (index < 0 || index > last || index === current) return
    // Solo se frena al avanzar: volver atrás siempre se puede.
    if (index > current && guard?.(current, index)) {
      setAttempted(true)
      return
    }
    setAttempted(false)
    onChange(index)
    top.current?.scrollIntoView?.({ block: 'start' })
  }

  const blocked = attempted ? guard?.(current, current + 1) : null

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

      {blocked && (
        <div className="wizard__guard" role="alert">
          <Icon name="alert" size={18} />
          <p>{blocked.message}</p>
          {blocked.onAction && (
            <Button variant="primary" iconRight="load" onClick={blocked.onAction}>
              {blocked.actionLabel}
            </Button>
          )}
        </div>
      )}

      <div className="step-nav">
        <Button icon="arrowLeft" onClick={() => goTo(current - 1)} disabled={current === 0}>
          Anterior
        </Button>
        <span className="muted small">
          Paso {current + 1} de {steps.length} · {steps[current].label}
        </span>
        <Button variant="primary" iconRight="arrowRight" onClick={() => goTo(current + 1)} disabled={current === last}>
          Siguiente
        </Button>
      </div>
    </div>
  )
}
