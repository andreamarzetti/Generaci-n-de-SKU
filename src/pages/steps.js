/**
 * Pasos del flujo: 1 Datos · 2 Propuesta · 3 Validar y confirmar.
 * Cada paso se marca como completo recién cuando se cumple su condición; el paso
 * actual lo decide el usuario (siguiente, anterior o clic en el número).
 */
export function buildSteps(stages) {
  return [
    { id: 'datos', label: 'Datos', done: Boolean(stages.data) },
    { id: 'propuesta', label: 'Propuesta', done: Boolean(stages.proposal) },
    {
      id: 'confirmacion',
      label: 'Validar y confirmar',
      done: Boolean(stages.confirmation),
      error: stages.validation === 'error',
    },
  ]
}
