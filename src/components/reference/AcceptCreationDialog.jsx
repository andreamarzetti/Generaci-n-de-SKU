import { getTarget } from '../../reference/targets'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

/**
 * "¿Aceptás la creación?": lista lo nuevo y los SKU que lo usan. Hasta aceptar, esos SKU
 * quedan bloqueados. Cancelar no cambia nada.
 */
export function AcceptCreationDialog({ entries, skus = [], onAccept, onCancel }) {
  return (
    <Modal
      title={skus.length ? 'Aceptar la creación de los SKU' : 'Aceptar la creación'}
      onClose={onCancel}
      footer={
        <>
          <Button icon="close" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="success" icon="check" onClick={() => onAccept(entries.map((entry) => entry.id))}>
            Aceptar
          </Button>
        </>
      }
    >
      <p>
        {skus.length > 0
          ? 'Estos SKU usan datos nuevos que todavía no están en CODIFICACION 2023. Al aceptar, se da por autorizada su creación.'
          : 'Estos datos nuevos todavía no están en CODIFICACION 2023. Al aceptar, se da por autorizada su creación.'}
      </p>

      <h3 className="modal__subtitle">Datos nuevos ({entries.length})</h3>
      <ul className="accept-list">
        {entries.map((entry) => {
          const target = getTarget(entry.target)
          return (
            <li key={entry.id}>
              <strong>{target?.kindLabel}</strong> · {target?.label} ·{' '}
              <span className="mono">{entry.values.codigo ?? ''}</span> {entry.values.descripcion ?? entry.values.ingles ?? ''}
            </li>
          )
        })}
      </ul>

      {skus.length > 0 && (
        <>
          <h3 className="modal__subtitle">SKU que se crearían ({skus.length})</h3>
          <p className="accept-skus mono">{skus.join(' · ')}</p>
        </>
      )}
    </Modal>
  )
}
