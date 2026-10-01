import { Fragment } from 'react'
import { MAX_SKU_LENGTH } from '../../rules/constants'
import { MAX_TANGO_DESCRIPTION } from '../../rules/descriptions'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { CollapsibleGroups, groupByVariant } from '../ui/CollapsibleGroups'
import { STATUS_META } from '../ui/status'
import { LinkButton } from '../ui/LinkButton'

const digits = (value) => value.replace(/\D/g, '')
const price = (value) => value.replace(/[^\d.,]/g, '')

export function SkuTable({ family, rows, rowData, results, onRowChange, validationStatus }) {
  const resultsByKey = Object.fromEntries((results ?? []).map((result) => [result.key, result]))
  const showSource = family.scheme === 'talleSufijo' || family.scheme === 'calzado'
  const barcodeRequired = family.scheme === 'cascos'
  const columns = showSource ? 8 : 7

  const groups = groupByVariant(rows, { resultsByKey })
  const renderTable = (list) => (
    <div className="table-wrap">
      <table className="table table--centered">
        <thead>
          <tr>
            <th>Talle</th>
            {showSource && <th>Cód. proveedor</th>}
            <th>SKU propuesto</th>
            <th className="num">Largo</th>
            <th>Cód. barras{barcodeRequired ? '' : ' (opc.)'}</th>
            <th>EAN</th>
            <th>Precio (opc.)</th>
            <th>Resultado</th>
          </tr>
        </thead>
        <tbody>
          {list.map((row) => {
            const result = resultsByKey[row.key]
            const data = rowData[row.key] ?? {}
            const length = row.sku?.length ?? 0
            const rowClass = [result ? `row--${result.status}` : '', result?.omit ? 'row--omit' : ''].join(' ')
            return (
              <Fragment key={row.key}>
                <tr className={`${rowClass} row--main`}>
                  <td>
                    <span className="strong">{row.label}</span>
                    {row.size?.normalized && <span className="size-received">recibido {row.size.raw}</span>}
                    {row.line && <span className="size-received muted">línea {row.line}</span>}
                  </td>
                  {showSource && <td className="mono muted">{row.source}</td>}
                  <td className="mono strong">{row.sku ?? <span className="muted small">sin armar</span>}</td>
                  <td className={`num mono ${length > MAX_SKU_LENGTH ? 'text-error strong' : ''}`}>{length || '—'}</td>
                  <td>
                    <input
                      className="input input--mono input--sm"
                      aria-label={`Código de barras ${row.label}`}
                      inputMode="numeric"
                      maxLength={14}
                      placeholder="Código de barras"
                      value={data.barras ?? ''}
                      onChange={(e) => onRowChange(row.key, 'barras', digits(e.target.value))}
                    />
                  </td>
                  <td>
                    <input
                      className="input input--mono input--sm"
                      aria-label={`EAN ${row.label}`}
                      inputMode="numeric"
                      maxLength={14}
                      placeholder="EAN"
                      value={data.ean ?? ''}
                      onChange={(e) => onRowChange(row.key, 'ean', digits(e.target.value))}
                    />
                  </td>
                  <td>
                    <input
                      className="input input--sm input--price"
                      aria-label={`Precio ${row.label}`}
                      inputMode="decimal"
                      placeholder="—"
                      value={data.precio ?? ''}
                      onChange={(e) => onRowChange(row.key, 'precio', price(e.target.value))}
                    />
                  </td>
                  <td>
                    <RowResult result={result} validationStatus={validationStatus} />
                  </td>
                </tr>
                <tr className={`${rowClass} row--sub`}>
                  <td colSpan={columns}>
                    <DescriptionRow row={row} onRowChange={onRowChange} />
                  </td>
                </tr>
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <Card
      title="SKUs a generar"
      aside={
        <span className="muted small">
          {rows.length} {rows.length === 1 ? 'código' : 'códigos'}
        </span>
      }
    >
      {rows.length === 0 ? (
        <p className="empty">Completá los datos del artículo para ver la propuesta.</p>
      ) : groups ? (
        <CollapsibleGroups groups={groups}>{(group) => renderTable(group.rows)}</CollapsibleGroups>
      ) : (
        renderTable(rows)
      )}
    </Card>
  )
}

/** Descripción Tango (editable, con el conteo contra 30) y GS1 derivada, debajo de cada SKU. */
function DescriptionRow({ row, onRowChange }) {
  const { tango } = row
  return (
    <div className="desc-row">
      <label className="desc-row__field">
        <span className="desc-row__label">Descripción Tango</span>
        <input
          className="input input--mono input--sm desc-row__input"
          value={tango.text}
          placeholder="Se arma desde la descripción"
          onChange={(e) => onRowChange(row.key, 'descTango', e.target.value.toUpperCase())}
        />
        <span className={`field__counter ${tango.text ? (tango.overLimit ? 'is-warn' : 'is-ok') : ''}`}>
          {tango.length}/{MAX_TANGO_DESCRIPTION}
        </span>
        {tango.edited && (
          <LinkButton icon="undo" onClick={() => onRowChange(row.key, 'descTango', undefined)}>
            Restablecer
          </LinkButton>
        )}
      </label>
      <span className="desc-row__gs1">
        <span className="desc-row__label">GS1</span>
        <span className="mono">{row.gs1 || '—'}</span>
      </span>
    </div>
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
