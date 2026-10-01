import { MAX_SKU_LENGTH } from '../../rules/constants'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { isPendingAlta } from '../../reference/store'
import { CollapsibleGroups } from '../ui/CollapsibleGroups'
import { Tooltip } from '../ui/Tooltip'

export function SkuComposition({ segments, rowSegments = [], proposal, onChooseFreeDigit, showFreeDigits, info }) {
  const lengths = proposal.rows.filter((row) => row.sku).map((row) => row.sku.length)
  const longest = lengths.length ? Math.max(...lengths) : 0
  const hasPending = segments.some((segment) => segment.pending)
  const groups = proposal.groups ?? []
  const skusByVariant = groupByVariant(rowSegments)

  // Una tabla con la composición de los SKU de una variante (o de todos, si hay una sola).
  const renderTable = (items) => (
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
          {items.length === 0 ? (
            <SegmentRow segments={segments} error={proposal.issues[0]} showMessage={false} />
          ) : (
            items.map(({ row, segments: rowParts }) => (
              <SegmentRow key={row.key} segments={rowParts} error={row.sku ? null : (row.buildError ?? 'Falta completar datos')} />
            ))
          )}
        </tbody>
      </table>
    </div>
  )

  // Con varias variantes: la primera expandida y las demás comprimidas.
  const variantGroups =
    skusByVariant.length > 1
      ? skusByVariant.map(([variant, items]) => {
          const unresolved = items.filter(({ row }) => !row.sku).length
          return {
            key: variant || 'sin descripción',
            title: variant || 'sin descripción',
            items,
            meta: (
              <>
                <span>
                  {items.length} {items.length === 1 ? 'SKU' : 'SKUs'}
                </span>
                {unresolved > 0 && <Badge tone="error">{unresolved} sin armar</Badge>}
              </>
            ),
          }
        })
      : null

  return (
    <Card
      title="Composición del SKU"
      className="card--composition"
      info={info}
      aside={
        <span className={`length-meter ${longest > MAX_SKU_LENGTH ? 'is-error' : longest ? 'is-ok' : ''}`}>
          {longest || '—'} / máx. {MAX_SKU_LENGTH} caracteres
          {lengths.length > 1 && <small> (el más largo)</small>}
        </span>
      }
    >
      {variantGroups ? (
        <CollapsibleGroups groups={variantGroups}>{(group) => renderTable(group.items)}</CollapsibleGroups>
      ) : (
        renderTable(rowSegments)
      )}
      {rowSegments.length > 0 && (
        <p className="muted small sku-parts__count">
          {rowSegments.length} {rowSegments.length === 1 ? 'SKU' : 'SKUs'} por talle
        </p>
      )}

      {(proposal.generics ?? []).length > 0 && (
        <p className="sku-generic">
          <span className="sku-generic__label">SKU genérico (el mismo SKU sin talle)</span>
          {proposal.generics.map((item) => (
            <span key={item.sku} className="mono strong">
              {item.sku}
            </span>
          ))}
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
                  {visibleFreeDigits(group).map((option) => (
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

      {hasPending && <p className="footnote">* Dígitos libres: 01–99 y, si se agotan, alfanuméricos (A1…A0, B1…).</p>}
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
            <SegmentValue segment={segment} />
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

/** El código de una parte del SKU; al pasar el mouse explica qué significa (ej. 10 → Tipología: FF SV). */
function SegmentValue({ segment }) {
  const { value, detail } = segment
  if (!value) return '·'.repeat(segment.size ?? 3)
  if (!detail) return value

  const pending = detail.alta && isPendingAlta(detail.alta)
  return (
    <Tooltip
      content={
        <>
          <strong className="tooltip__title">{detail.title}</strong>
          <span>{detail.plain ? detail.text : `${value} → ${detail.text ?? 'sin descripción en la tabla'}`}</span>
          {pending && <em className="tooltip__note">Dato nuevo: pendiente de aceptar</em>}
        </>
      }
    >
      {value}
    </Tooltip>
  )
}

/** La lista completa tiene más de 600 pares: se muestran los próximos 30 desde el primero libre y el elegido. */
function visibleFreeDigits(group) {
  const firstFree = Math.max(
    group.options.findIndex((option) => !option.usedIn),
    0,
  )
  return group.options.filter((option, index) => index <= firstFree + 30 || option.value === group.freeDigit)
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
