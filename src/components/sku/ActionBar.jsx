import { Button } from '../ui/Button'

export function ActionBar({
  validationStatus,
  summary,
  canValidate,
  canConfirm,
  warningsAcknowledged,
  onAcknowledge,
  onValidate,
  onConfirm,
  pendingAltas = 0,
}) {
  const validated = validationStatus === 'done'
  const running = validationStatus === 'running'
  const showAck = validated && summary.error === 0 && summary.warn > 0

  let hint = ''
  if (!canValidate) hint = 'Completá los datos para poder validar.'
  else if (!validated && !running) hint = 'Ejecutá las validaciones antes de confirmar.'
  else if (validated && summary.error > 0)
    hint = `Resolvé ${summary.error} ${summary.error === 1 ? 'bloqueante' : 'bloqueantes'} para confirmar.`
  else if (pendingAltas > 0) hint = 'Aceptá la creación de los datos nuevos para confirmar.'
  else if (showAck && !warningsAcknowledged) hint = 'Revisá las advertencias para confirmar.'

  return (
    <div className="action-bar">
      <div className="action-bar__info">
        {showAck && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={warningsAcknowledged}
              onChange={(e) => onAcknowledge(e.target.checked)}
            />
            Revisé las advertencias y quiero confirmar igual
          </label>
        )}
        {hint && <p className="action-bar__hint">{hint}</p>}
      </div>
      <div className="action-bar__buttons">
        <Button onClick={onValidate} disabled={!canValidate || running}>
          {running ? 'Validando…' : validated ? 'Volver a validar' : 'Ejecutar validaciones'}
        </Button>
        <Button variant="primary" onClick={onConfirm} disabled={!canConfirm}>
          Confirmar SKU
        </Button>
      </div>
    </div>
  )
}
