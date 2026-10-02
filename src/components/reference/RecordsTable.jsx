import { ALTA_STATUS, getAlta } from '../../reference/store'
import { Badge } from '../ui/Badge'

const PLANTILLAS = { cascos: 'Cascos', producto: 'Producto', ambos: 'Cascos y producto', propio: 'Motor propio' }
const cell = (field, values) => (field.name === 'plantilla' ? (PLANTILLAS[values[field.name]] ?? values[field.name]) : (values[field.name] ?? '—'))

/**
 * Registros de una tabla de referencia: los que ya existen y las altas nuevas (con su estado).
 * `highlight(values)` marca las filas que coinciden con lo que se está cargando (ej. un código repetido).
 */
export function RecordsTable({ columns, records, max = 400, searching = false, highlight, repeated, className = 'reference-table' }) {
  const visible = records.slice(0, max)

  return (
    <div className={`table-wrap ${className}`}>
      <table className="table table--compact">
        <thead>
          <tr>
            {columns.map((field) => (
              <th key={field.name}>{field.label}</th>
            ))}
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {visible.map(({ alta, values }, index) => {
            const status = alta ? getAlta(alta)?.status : null
            const matches = highlight?.(values)
            return (
              <tr key={`${alta ?? 'base'}-${values.codigo ?? values.ingles}-${index}`} className={`${alta ? 'is-new' : ''} ${matches ? 'is-match' : ''}`}>
                {columns.map((field) => (
                  <td key={field.name} className={field.name === 'codigo' ? 'mono strong' : ''}>
                    {cell(field, values)}
                  </td>
                ))}
                <td>
                  <span className="records__state">
                    {alta ? (
                      <Badge tone={status === ALTA_STATUS.ACCEPTED ? 'ok' : 'warn'}>
                        {status === ALTA_STATUS.ACCEPTED ? 'Nueva · aceptada' : 'Nueva · pendiente'}
                      </Badge>
                    ) : (
                      <span className="muted">Existente</span>
                    )}
                    {repeated?.has(values.codigo) && <Badge tone="warn">Código repetido</Badge>}
                  </span>
                </td>
              </tr>
            )
          })}
          {visible.length === 0 && (
            <tr>
              <td colSpan={columns.length + 1} className="muted">
                No hay registros{searching ? ' con esa búsqueda' : ''}.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
