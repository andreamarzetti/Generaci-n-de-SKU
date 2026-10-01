import { useState } from 'react'
import { acceptAltas } from '../../reference/store'
import { getTarget } from '../../reference/targets'
import { Button } from '../ui/Button'
import { AcceptCreationDialog } from './AcceptCreationDialog'

/**
 * Aviso en la confirmación: los SKU que usan datos nuevos están bloqueados hasta que el
 * usuario acepta su creación (ventana con Aceptar / Cancelar).
 */
export function PendingAltasNotice({ altas, skus }) {
  const [open, setOpen] = useState(false)
  if (altas.length === 0) return null

  return (
    <div className="pending-altas" role="alert">
      <div>
        <p className="pending-altas__title">Los SKU están bloqueados: usan datos nuevos sin aceptar</p>
        <p className="pending-altas__list">
          {altas
            .map((alta) => `${getTarget(alta.target)?.kindLabel}: ${alta.values.codigo ?? ''} ${alta.values.descripcion ?? alta.values.ingles ?? ''}`.replace(/\s+/g, ' ').trim())
            .join(' · ')}
        </p>
      </div>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Revisar y aceptar
      </Button>
      {open && (
        <AcceptCreationDialog
          entries={altas}
          skus={skus}
          onCancel={() => setOpen(false)}
          onAccept={(ids) => {
            acceptAltas(ids)
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}
