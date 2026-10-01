import { Modal } from '../ui/Modal'
import { AltaForm } from './AltaForm'

/** Ventana para crear un alta sin salir de lo que se está haciendo. */
export function AltaDialog({ initial, lockTarget = false, onClose, onSaved }) {
  return (
    <Modal title="Nueva alta de referencia" onClose={onClose}>
      <AltaForm
        idPrefix="alta-dialog"
        initial={initial}
        lockTarget={lockTarget}
        onCancel={onClose}
        onSaved={(entry) => {
          onSaved?.(entry)
          onClose()
        }}
      />
    </Modal>
  )
}
