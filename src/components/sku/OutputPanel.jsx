import { RULE_STATUS } from '../../rules/constants'
import { ALTA_DATA, CLASSIFICATION_RULE, TANGO_FILE } from '../../rules/output'
import { isValidGtin } from '../../utils/gtin'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'

const statusBadge = (status) =>
  status === RULE_STATUS.CONFIRMED ? <Badge tone="ok">Confirmada</Badge> : <Badge tone="warn">A validar</Badge>

/** Salida para Tango y GS1: solo se muestra, no se envía a ningún lado. */
export function OutputPanel({ family, classification, rows, rowData, results }) {
  const total = rows.length
  const withPrice = rows.filter((row) => String(rowData[row.key]?.precio ?? '').trim()).length
  const eanReady = results
    ? results.filter((result) => result.checks.ean.status === 'ok').length
    : rows.filter((row) => isValidGtin(String(rowData[row.key]?.ean ?? ''))).length

  return (
    <Card title="Salida para Tango y GS1" aside={<span className="muted small">Solo informativo · no se envía</span>}>
      <div className="output">
        <section className="output__block">
          <h3 className="output__title">Datos del alta</h3>
          <dl className="output__list">
            {ALTA_DATA.map((item) => (
              <div key={item.id} className="output__row">
                <dt>{item.label}</dt>
                <dd>
                  <span className="output__value">{item.value}</span>
                  {statusBadge(item.status)}
                  <span className="output__source">
                    Fuente: {item.source}
                    {item.note ? ` · ${item.note}` : ''}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="output__block">
          <h3 className="output__title">
            Clasificación propuesta {statusBadge(CLASSIFICATION_RULE.status)}
          </h3>
          {classification ? (
            <ol className="tree" aria-label="Clasificación propuesta">
              {classification.map((level, index) => (
                <li key={`${index}-${level}`} className={index === classification.length - 1 ? 'is-last' : ''}>
                  {level}
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted small">Elegí el código genérico para armar la clasificación.</p>
          )}
          <p className="output__source">Fuente: {CLASSIFICATION_RULE.source}</p>
        </section>

        <section className="output__block">
          <h3 className="output__title">Archivo de alta para Tango (resumen)</h3>
          <dl className="output__list output__list--compact">
            <div className="output__row"><dt>Artículos</dt><dd className="strong">{total} + genérico</dd></div>
            <div className="output__row"><dt>Unidades de compra</dt><dd className="strong">{total}</dd></div>
            <div className="output__row">
              <dt>Precios · {TANGO_FILE.priceLists} listas por talle</dt>
              <dd className={withPrice === total && total ? 'text-ok strong' : 'text-warn strong'}>
                {withPrice} de {total} talles con precio
              </dd>
            </div>
            <div className="output__row"><dt>Proveedores</dt><dd className="mono">{TANGO_FILE.suppliers.join(' · ')}</dd></div>
          </dl>
          <p className="output__source">
            {TANGO_FILE.sheets.length} hojas: {TANGO_FILE.sheets.join(', ')}. Cómo se reparte el precio en las{' '}
            {TANGO_FILE.priceLists} listas queda pendiente de la plantilla oficial.
          </p>
        </section>

        <section className="output__block">
          <h3 className="output__title">GS1</h3>
          <dl className="output__list output__list--compact">
            <div className="output__row">
              <dt>EAN · archivo masivo</dt>
              <dd className={eanReady === total && total ? 'text-ok strong' : 'text-warn strong'}>
                {eanReady} de {total} listos
              </dd>
            </div>
            <div className="output__row"><dt>DUN</dt><dd className="muted strong">Pendiente</dd></div>
          </dl>
          {family.scheme === 'cascos' && rows[0]?.gs1 && (
            <p className="output__source">
              Descripción GS1 (solo letras): <span className="mono">{rows[0].gs1}</span>
            </p>
          )}
        </section>
      </div>
    </Card>
  )
}
