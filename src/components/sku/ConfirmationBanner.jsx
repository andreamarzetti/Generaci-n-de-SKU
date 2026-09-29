import { useState } from 'react'
import { downloadXlsx, DUN_PENDING, SUMMARY_COLUMNS, summaryTsv } from '../../services/exportLote'
import { Button } from '../ui/Button'

/** Lote confirmado: resumen para copiar (como el mail de cierre de un alta) y descarga .xlsx. */
export function ConfirmationBanner({ confirmation, onStartNew }) {
  const [feedback, setFeedback] = useState('')
  const { items } = confirmation

  const flash = (message) => {
    setFeedback(message)
    setTimeout(() => setFeedback(''), 2200)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summaryTsv(items))
      flash('Resumen copiado')
    } catch {
      flash('No se pudo copiar: seleccioná la tabla y copiala a mano')
    }
  }

  const download = async () => {
    try {
      const stamp = confirmation.at.toISOString().slice(0, 10)
      await downloadXlsx(items, `alta-LS2-${confirmation.familyLabel}-${stamp}.xlsx`)
      flash('Archivo descargado')
    } catch {
      flash('No se pudo generar el archivo')
    }
  }

  return (
    <div className="confirmation" role="status">
      <div className="confirmation__head">
        <div>
          <p className="confirmation__title">
            {items.length} {items.length === 1 ? 'SKU confirmado' : 'SKUs confirmados'} · {confirmation.familyLabel}
          </p>
          <p className="confirmation__note">Registrados solo en esta sesión (mock). No se envió nada a Tango.</p>
        </div>
        <div className="confirmation__actions">
          <Button onClick={copy}>Copiar resumen</Button>
          <Button onClick={download}>Descargar .xlsx</Button>
          <Button variant="dark" onClick={onStartNew}>
            Nueva generación
          </Button>
        </div>
      </div>

      <div className="table-wrap confirmation__table">
        <table className="table table--compact">
          <thead>
            <tr>
              {SUMMARY_COLUMNS.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.sku}>
                <td className="mono strong">{item.sku}</td>
                <td className="mono">{item.descTango}</td>
                <td className="mono">{item.ean}</td>
                <td className="mono">{item.generico}</td>
                <td className="muted">{DUN_PENDING}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="confirmation__note">
        {feedback && <strong>{feedback}. </strong>}
        El .xlsx trae una hoja "Artículos" (SKU, Descripción, EAN, Código genérico, Talle, Precio). El formato de
        importación a Tango se ajusta cuando tengamos la plantilla oficial.
      </p>
    </div>
  )
}
