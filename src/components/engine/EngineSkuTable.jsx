import { MAX_SKU_LENGTH } from '../../rules/constants'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { STATUS_META } from '../ui/status'

const digits = (value) => value.replace(/\D/g, '')

/** SKUs a generar con un motor: EAN opcional y descripción manual por fila. */
export function EngineSkuTable({ rows, rowData, results, onRowChange, validationStatus }) {
  const resultsByKey = Object.fromEntries((results ?? []).map((result) => [result.key, result]))

  return (
    <Card
      title="SKUs a generar"
      aside={<span className="muted small">{rows.length} {rows.length === 1 ? 'código' : 'códigos'}</span>}
    >
      {rows.length === 0 ? (
        <p className="empty">Elegí los segmentos y al menos un talle para ver la propuesta.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Talle</th>
                <th>SKU propuesto</th>
                <th className="num">Largo</th>
                <th>EAN (opc.)</th>
                <th>Descripción (manual)</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const result = resultsByKey[row.key]
                const length = row.sku?.length ?? 0
                return (
                  <tr key={row.key} className={result ? `row--${result.status}` : ''}>
                    <td className="strong">{row.label}</td>
                    <td className="mono strong">{row.sku ?? <span className="muted small">sin armar</span>}</td>
                    <td className={`num mono ${length > MAX_SKU_LENGTH ? 'text-error strong' : ''}`}>{length || '—'}</td>
                    <td>
                      <input
                        className="input input--mono input--sm"
                        aria-label={`EAN ${row.label}`}
                        inputMode="numeric"
                        maxLength={14}
                        placeholder="EAN"
                        value={rowData[row.key]?.ean ?? ''}
                        onChange={(e) => onRowChange(row.key, 'ean', digits(e.target.value))}
                      />
                    </td>
                    <td>
                      <input
                        className="input input--sm desc-row__input"
                        aria-label={`Descripción ${row.label}`}
                        placeholder="Descripción"
                        value={row.descripcion}
                        onChange={(e) => onRowChange(row.key, 'descripcion', e.target.value.toUpperCase())}
                      />
                    </td>
                    <td>
                      <RowResult result={result} validationStatus={validationStatus} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function RowResult({ result, validationStatus }) {
  if (validationStatus === 'running') return <span className="muted small">Validando…</span>
  if (!result) return <span className="muted small">Sin validar</span>
  const meta = STATUS_META[result.status]
  const issues = Object.values(result.checks).filter((check) => check.status === result.status && check.status !== 'ok')
  return (
    <div className="row-result">
      <Badge tone={meta.tone}>{meta.label}</Badge>
      {issues[0] && (
        <span className={`small text-${meta.tone}`}>
          {issues[0].message}
          {issues.length > 1 && ` (+${issues.length - 1})`}
        </span>
      )}
    </div>
  )
}
