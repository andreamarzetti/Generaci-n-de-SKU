import { useState } from 'react'
import { effectiveSizes, hasOwnSizes, toggleInOrder } from '../../rules/variantPlan'
import { Button } from '../ui/Button'
import { LinkButton } from '../ui/LinkButton'

/**
 * Carga masiva de varias variantes: una curva de talles para todas y, en cada variante,
 * la posibilidad de editar sus propios talles. Los cambios de una variante se aplican con «Guardar».
 * Se usa en LS2 y en los motores de las marcas.
 *
 * sizeGroups: [{ label, sizes: [{ code, label }] }] · allowNoSize agrega "Sin talle".
 */
export function VariantPlanner({
  variants,
  curve,
  sizeGroups,
  allowNoSize = false,
  onToggleCurve,
  onSaveVariantSizes,
  onResetVariant,
  onRemoveVariant,
  onExit,
  idPrefix = 'plan',
}) {
  // Variante que se está editando y sus talles todavía sin guardar.
  const [editing, setEditing] = useState(null)
  const sizeOrder = [...sizeGroups.flatMap((group) => group.sizes.map((size) => size.code)), ...(allowNoSize ? [''] : [])]
  const labelOf = (code) =>
    code ? (sizeGroups.flatMap((group) => group.sizes).find((size) => size.code === code)?.label ?? code) : 'Sin talle'

  const startEditing = (variant) => setEditing({ key: variant.key, sizes: effectiveSizes(variant, curve) })
  const save = () => {
    onSaveVariantSizes(editing.key, editing.sizes)
    setEditing(null)
  }

  const picker = (selected, onToggle, label) => (
    <div className="plan__picker">
      {sizeGroups.map((group) => (
        <div key={group.label} className="size-group">
          {sizeGroups.length > 1 && <span className="size-group__label">{group.label}</span>}
          <div className="size-picker" role="group" aria-label={`${label} ${group.label}`}>
            {group.sizes.map((size) => (
              <button
                key={size.code}
                type="button"
                aria-pressed={selected.includes(size.code)}
                className={`size-chip ${selected.includes(size.code) ? 'is-active' : ''}`}
                onClick={() => onToggle(size.code)}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      {allowNoSize && (
        <div className="size-picker" role="group" aria-label={`${label} sin talle`}>
          <button
            type="button"
            aria-pressed={selected.includes('')}
            className={`size-chip ${selected.includes('') ? 'is-active' : ''}`}
            onClick={() => onToggle('')}
          >
            Sin talle
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="plan" id={`${idPrefix}-variantes`}>
      <div className="plan__head">
        <p className="plan__title">
          Carga masiva · {variants.length} {variants.length === 1 ? 'variante' : 'variantes'}
        </p>
        {onExit && (
          <Button size="sm" variant="ghost" icon="arrowLeft" onClick={onExit}>
            Volver a carga individual
          </Button>
        )}
      </div>

      <div className="field">
        <span className="field__label">Curva de talles para todas las variantes</span>
        {picker(curve, onToggleCurve, 'Curva')}
        <p className="field__hint">
          {curve.length
            ? `${curve.length} ${curve.length === 1 ? 'talle' : 'talles'}: ${curve.map(labelOf).join(' · ')}.`
            : 'Elegí al menos un talle.'}{' '}
          Un SKU por variante y talle.
        </p>
      </div>

      <ul className="plan__list" aria-label="Variantes">
        {variants.map((variant) => {
          const sizes = effectiveSizes(variant, curve)
          const own = hasOwnSizes(variant)
          const open = editing?.key === variant.key
          return (
            <li key={variant.key} className={`plan__item ${own ? 'is-custom' : ''}`}>
              <div className="plan__row">
                <span className="plan__name mono">{variant.descripcion}</span>
                <span className="plan__sizes">
                  {own ? <span className="badge badge--warn">Talles propios</span> : <span className="badge badge--neutral">Curva</span>}{' '}
                  {sizes.length ? sizes.map(labelOf).join(' · ') : 'sin talles'}
                </span>
                <span className="table-actions">
                  {!open && (
                    <LinkButton icon="edit" iconOnly aria-expanded={false} onClick={() => startEditing(variant)}>
                      Editar talles
                    </LinkButton>
                  )}
                  {own && !open && (
                    <LinkButton icon="undo" iconOnly onClick={() => onResetVariant(variant.key)}>
                      Usar la curva
                    </LinkButton>
                  )}
                  {variants.length > 1 && !open && (
                    <LinkButton tone="danger" icon="trash" iconOnly onClick={() => onRemoveVariant(variant.key)}>
                      Quitar
                    </LinkButton>
                  )}
                </span>
              </div>
              {open && (
                <div className="plan__edit">
                  {picker(
                    editing.sizes,
                    (code) => setEditing({ ...editing, sizes: toggleInOrder(editing.sizes, code, sizeOrder) }),
                    `Talles de ${variant.descripcion}`,
                  )}
                  <p className="field__hint">Solo cambia esta variante: las demás siguen con la curva. Se aplica al guardar.</p>
                  <div className="plan__edit-actions">
                    <Button size="sm" variant="success" icon="save" onClick={save} disabled={editing.sizes.length === 0}>
                      Guardar
                    </Button>
                    <Button size="sm" icon="close" onClick={() => setEditing(null)}>
                      Cancelar
                    </Button>
                    {editing.sizes.length === 0 && <span className="small text-warn">Elegí al menos un talle para guardar.</span>}
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
