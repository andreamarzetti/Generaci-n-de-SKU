import { useState } from 'react'
import { Modal } from './Modal'

/** Ícono (i) que abre un popup con información de referencia de la sección donde está. */
export function InfoPopup({ label, title = label, wide = false, children }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="info-button"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        i
      </button>
      {open && (
        <Modal title={title} wide={wide} onClose={() => setOpen(false)}>
          {children}
        </Modal>
      )}
    </>
  )
}
