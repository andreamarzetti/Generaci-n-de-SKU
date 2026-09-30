/**
 * Indicadores Datos / Propuesta / Validación / Confirmación.
 * Cada etapa se marca como completa recién cuando se cumple su condición.
 * La primera etapa incompleta es la actual; las demás quedan pendientes.
 */
export function buildSteps(stages) {
  const steps = [
    { id: 'datos', label: 'Datos', done: stages.data },
    { id: 'propuesta', label: 'Propuesta', done: stages.proposal },
    { id: 'validacion', label: 'Validación', done: stages.validation === 'ok', error: stages.validation === 'error' },
    { id: 'confirmacion', label: 'Confirmación', done: stages.confirmation },
  ]
  let currentAssigned = false
  return steps.map((step) => {
    if (step.done) return { ...step, state: 'done' }
    if (step.error) {
      currentAssigned = true
      return { ...step, state: 'error' }
    }
    if (!currentAssigned) {
      currentAssigned = true
      return { ...step, state: 'current' }
    }
    return { ...step, state: 'todo' }
  })
}
