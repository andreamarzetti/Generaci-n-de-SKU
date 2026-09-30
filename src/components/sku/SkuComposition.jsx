import { Fragment } from 'react'
import { MAX_SKU_LENGTH } from '../../rules/constants'
import { Card } from '../ui/Card'

export function SkuComposition({ segments, rowSegments = [], proposal, onChooseFreeDigit, showFreeDigits }) {
  const lengths = proposal.rows.filter((row) => row.sku).map((row) => row.sku.length)
  const longest = lengths.length ? Math.max(...lengths) : 0
  const hasPending = segments.some((segment) => segment.pending)
  const groups = proposal.groups ?? []
  const skusByVariant = groupByVariant(rowSegments)

  return (
    <Card
      title="Composición del SKU"
      className="card--composition"
      aside={
        <span className={`length-meter ${longest > MAX_SKU_LENGTH ? 'is-error' : longest ? 'is-ok' : ''}`}>
          {longest || '—'} / máx. {MAX_SKU_LENGTH} caracteres
          {lengths.length > 1 && <small> (el más largo)</small>}
        </span>
      }
    >
      <div className="sku-parts-wrap">
        <table className="sku-parts">
          <thead>
            <tr>
              {segments.map((segment) => (
                <th key={segment.id} scope="col">
                  {segment.label}
                  {segment.pending && <sup title="A validar">*</sup>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowSegments.length === 0 ? (
              <SegmentRow segments={segments} error={proposal.issues[0]} showMessage={false} />
            ) : (
              skusByVariant.map(([variant, items]) => (
                <Fragment key={variant}>
                  {skusByVariant.length > 1 && (
                    <tr>
                      <th colSpan={segments.length} scope="rowgroup" className="sku-parts__variant">
                        {variant || 'sin descripción'}
                      </th>
                    </tr>
                  )}
                  {items.map(({ row, segments: rowParts }) => (
                    <SegmentRow key={row.key} segments={rowParts} error={row.sku ? null : (row.buildError ?? 'Falta completar datos')} />
                  ))}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
      {rowSegments.length > 0 && (
        <p className="muted small sku-parts__count">
          {rowSegments.length} {rowSegments.length === 1 ? 'SKU' : 'SKUs'} por talle
        </p>
      )}

      {showFreeDigits && (
        <div className="free-digits">
          <p className="free-digits__title">
            Dos dígitos libres{groups.length > 1 ? ' por variante' : ''}{' '}
            <span className="muted">· disponibilidad contra los artículos reales de LS2 y la sesión (mock)</span>
          </p>
          {groups.length === 0 ? (
            <p className="muted small">Cargá el código de barras de los talles para buscar dígitos libres.</p>
          ) : (
            groups.map((group) => (
              <div key={group.key} className="free-digits__group">
                {groups.length > 1 && (
                  <p className="free-digits__variant">
                    <span className="mono strong">{group.prefix}</span> · {group.variant || 'sin descripción'}
                  </p>
                )}
                <select
                  className="input input--sm select free-digits__select"
                  aria-label={`Dígitos libres${group.prefix ? ` para ${group.prefix}` : ''}`}
                  value={group.freeDigit ?? ''}
                  onChange={(e) => onChooseFreeDigit(group.key, e.target.value)}
                >
                  {!group.freeDigit && <option value="">Sin dígitos libres</option>}
                  {group.options.map((option) => (
                    <option key={option.value} value={option.value} disabled={Boolean(option.usedIn)}>
                      {option.value} · {option.usedIn ? `en uso en ${option.usedIn}` : 'libre'}
                    </option>
                  ))}
                </select>
              </div>
            ))
          )}
        </div>
      )}

      {proposal.issues.length > 0 && (
        <ul className="input-issues">
          {proposal.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}

      {hasPending && <p className="footnote">* A validar: rango de dígitos libres 01–09, observado en los datos reales.</p>}
    </Card>
  )
}

/**
 * Un SKU en una fila de la tabla: cada componente en su columna, con su color.
 * Mientras tenga un error sin resolver, la fila queda marcada en amarillo con el motivo debajo.
 */
function SegmentRow({ segments, error, showMessage = true }) {
  return (
    <>
      <tr className={error ? 'is-unresolved' : ''} title={error ?? undefined}>
        {segments.map((segment) => (
          <td key={segment.id} className={`sku-parts__cell sku-parts__cell--${segment.variant} ${segment.value ? '' : 'is-empty'}`}>
            {segment.value || '·'.repeat(segment.size ?? 3)}
          </td>
        ))}
      </tr>
      {error && showMessage && (
        <tr className="sku-parts__error">
          <td colSpan={segments.length}>{error}</td>
        </tr>
      )}
    </>
  )
}

/** Agrupa los SKUs por variante (en la carga masiva de cascos, cada color es una variante). */
function groupByVariant(items) {
  const groups = new Map()
  items.forEach((item) => {
    const variant = item.row.variant ?? ''
    groups.set(variant, [...(groups.get(variant) ?? []), item])
  })
  return [...groups]
}
