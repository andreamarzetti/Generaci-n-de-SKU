import { useId, useState } from 'react'
import { Badge } from './Badge'
import { Icon } from './Icon'
import { LinkButton } from './LinkButton'

/**
 * Grupos plegables (uno por variante). El primero se muestra expandido y los demás comprimidos;
 * cada uno se abre o se cierra a mano, o todos juntos. El contenido queda en la página aunque
 * esté plegado (solo se oculta), así no se pierde lo que se escribió en sus campos.
 *
 * groups: [{ key, title, meta }] · children(group) dibuja el contenido de un grupo.
 */
export function CollapsibleGroups({ groups, children }) {
  const baseId = useId()
  const [open, setOpen] = useState({})
  const isOpen = (key, index) => open[key] ?? index === 0
  const allOpen = groups.every((group, index) => isOpen(group.key, index))
  const setAll = (value) => setOpen(Object.fromEntries(groups.map((group) => [group.key, value])))

  return (
    <div className="groups">
      <div className="groups__toolbar">
        <span className="muted small">{groups.length} variantes</span>
        <LinkButton icon={allOpen ? 'chevronUp' : 'chevronDown'} onClick={() => setAll(!allOpen)}>
          {allOpen ? 'Contraer todas' : 'Expandir todas'}
        </LinkButton>
      </div>
      {groups.map((group, index) => {
        const expanded = isOpen(group.key, index)
        const bodyId = `${baseId}-${index}`
        return (
          <section key={group.key} className={`group ${expanded ? 'is-open' : ''}`}>
            <h3 className="group__title">
              <button
                type="button"
                className="group__toggle"
                aria-expanded={expanded}
                aria-controls={bodyId}
                onClick={() => setOpen({ ...open, [group.key]: !expanded })}
              >
                <Icon name={expanded ? 'chevronDown' : 'chevronRight'} />
                <span className="group__name">{group.title}</span>
                <span className="group__meta">{group.meta}</span>
              </button>
            </h3>
            <div id={bodyId} className="group__body" hidden={!expanded}>
              {children(group)}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/** Cuántos SKU de las filas tienen error o advertencia en la validación (para ver el estado de un grupo plegado). */
function ResultBadges({ rows, resultsByKey }) {
  const count = (status) => rows.filter((row) => resultsByKey[row.key]?.status === status).length
  const errors = count('error')
  const warnings = count('warn')
  return (
    <>
      {errors > 0 && <Badge tone="error">{errors === 1 ? '1 con error' : `${errors} con error`}</Badge>}
      {warnings > 0 && <Badge tone="warn">{warnings === 1 ? '1 advertencia' : `${warnings} advertencias`}</Badge>}
    </>
  )
}

/**
 * Agrupa filas por variante. Devuelve null si hay una sola (o ninguna): no hace falta agrupar.
 * `buildMeta` permite agregar avisos propios (ej. "sin armar") al resumen de cada grupo.
 */
export function groupByVariant(rows, { resultsByKey = {}, buildMeta } = {}) {
  const byVariant = new Map()
  rows.forEach((row) => {
    const key = row.variant || 'sin descripción'
    byVariant.set(key, [...(byVariant.get(key) ?? []), row])
  })
  if (byVariant.size < 2) return null
  return [...byVariant].map(([key, items]) => ({
    key,
    title: key,
    rows: items,
    meta: (
      <>
        <span>
          {items.length} {items.length === 1 ? 'SKU' : 'SKUs'}
        </span>
        {buildMeta?.(items)}
        <ResultBadges rows={items} resultsByKey={resultsByKey} />
      </>
    ),
  }))
}
