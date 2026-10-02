import { useState } from 'react'
import { AcceptCreationDialog } from '../components/reference/AcceptCreationDialog'
import { AltaDialog } from '../components/reference/AltaDialog'
import { ReferenceTables } from '../components/reference/ReferenceTables'
import { PageHeader } from '../components/layout/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { altasFileName, downloadAltas } from '../reference/exportReferences'
import { acceptAltas, ALTA_STATUS, removeAlta } from '../reference/store'
import { getTarget } from '../reference/targets'
import { useAltas } from '../reference/useAltas'
import { LinkButton } from '../components/ui/LinkButton'

const day = (iso) => String(iso ?? '').slice(0, 10)

/**
 * Altas de referencia: lo que no está en CODIFICACION 2023 (marca, modelo, gráfica, color,
 * genérico…). Se crea acá o desde la revisión del mail, y se exporta a un Excel aparte.
 */
export function ReferencesPage() {
  const altas = useAltas()
  const [creating, setCreating] = useState(false)
  const [accepting, setAccepting] = useState(null)
  const [feedback, setFeedback] = useState('')
  const pending = altas.filter((alta) => alta.status === ALTA_STATUS.PENDING)

  const flash = (message) => {
    setFeedback(message)
    setTimeout(() => setFeedback(''), 2600)
  }

  const exportExcel = async () => {
    try {
      await downloadAltas(altas)
      flash(`Descargado: ${altasFileName()}`)
    } catch {
      flash('No se pudo generar el archivo')
    }
  }

  const remove = (id) => {
    const result = removeAlta(id)
    if (!result.ok) flash(result.reason)
  }

  return (
    <main className="main">
      <PageHeader title="Altas de referencia" subtitle="Datos nuevos que todavía no están en CODIFICACION 2023: marcas, modelos, gráficas, colores, tipologías y artículos. Los códigos genéricos no se cargan acá: se crean al generar el SKU." />

      <div className="wizard__panel">
        <ReferenceTables />

        <Card
          title={`Altas creadas por usuarios · ${altas.length}`}
          aside={
            <div className="card__actions">
              <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
                Nueva alta
              </Button>
              <Button icon="sheet" onClick={exportExcel} disabled={altas.length === 0}>
                Exportar a Excel
              </Button>
            </div>
          }
        >
          {altas.length === 0 ? (
            <p className="muted">
              Todavía no hay altas. Creá una con «Nueva alta», o desde la revisión de un mail cuando un dato no exista en las tablas.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th>Qué</th>
                    <th>Para</th>
                    <th>Código</th>
                    <th>Nombre</th>
                    <th>Estado</th>
                    <th>Creada</th>
                    <th>
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {altas.map((alta) => {
                    const target = getTarget(alta.target)
                    const isPending = alta.status === ALTA_STATUS.PENDING
                    return (
                      <tr key={alta.id}>
                        <td>{target?.kindLabel}</td>
                        <td>{target?.label}</td>
                        <td className="mono strong">{alta.values.codigo ?? '—'}</td>
                        <td>{alta.values.descripcion ?? alta.values.ingles}</td>
                        <td>
                          <Badge tone={isPending ? 'warn' : 'ok'}>{isPending ? 'Pendiente de aceptar' : 'Aceptada'}</Badge>
                        </td>
                        <td className="muted">
                          {day(alta.createdAt)} · {alta.createdBy}
                        </td>
                        <td>
                          {isPending && (
                            <span className="table-actions">
                              <LinkButton tone="success" icon="check" onClick={() => setAccepting([alta])}>
                                Aceptar
                              </LinkButton>
                              <LinkButton tone="danger" icon="trash" onClick={() => remove(alta.id)}>
                                Quitar
                              </LinkButton>
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="muted small alta-list__note">
            {feedback && <strong>{feedback}. </strong>}
            El Excel es un archivo aparte («{altasFileName()}»): trae las filas nuevas con las columnas de cada tabla, para pegarlas en
            CODIFICACION 2023. No se modifica el archivo original.
            {pending.length > 0 && ` Hay ${pending.length} pendiente${pending.length === 1 ? '' : 's'} de aceptar.`}
          </p>
        </Card>
      </div>

      {creating && <AltaDialog onClose={() => setCreating(false)} />}
      {accepting && (
        <AcceptCreationDialog
          entries={accepting}
          onCancel={() => setAccepting(null)}
          onAccept={(ids) => {
            acceptAltas(ids)
            setAccepting(null)
          }}
        />
      )}
    </main>
  )
}
