import { useState } from 'react'
import { BRANDS } from '../../engines/engines'
import { createAlta } from '../../reference/store'
import { brandsOf, exampleOf, getTarget, KINDS, kindsOfBrand, NEW_BRAND, suggestCode, targetsOfBrand, validateAlta } from '../../reference/targets'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { LinkButton } from '../ui/LinkButton'
import { ExistingCases } from './ExistingCases'

const DEFAULT_TARGET = 'calota-UBX'

/** Marca con la que arranca el formulario según lo que se quiere dar de alta. */
function initialBrand(target) {
  if (target.kind === 'marca') return NEW_BRAND
  return brandsOf(target)?.[0] ?? 'UBX'
}

/** Valores iniciales de un destino: lo que se pasó y el código sugerido (si la tabla lo permite). */
function startValues(target, values = {}) {
  const suggested = target.codeLength ? suggestCode(target, values) : ''
  return { ...(suggested ? { codigo: suggested } : {}), ...values }
}

/** Cómo se arma el SKU de una marca: orienta sobre qué tablas tiene (NTO y 921 no tienen calotas, por ejemplo). */
function brandHint(brandId) {
  const brand = BRANDS.find((item) => item.id === brandId)
  if (!brand) return ''
  if (!brand.lines) return 'LS2 no codifica calotas ni gráficas: su SKU sale del código de barras. Solo se dan de alta colores de la descripción. El código genérico se crea al generar el SKU.'
  const ids = brand.lines.map((line) => line.id)
  return [
    ids.includes('cascos') &&
      (brandId === 'GUD' ? 'Cascos: marca + tipología + gráfica + acabado + color + talle.' : 'Cascos: marca + tipología + calota + gráfica + color + talle.'),
    ids.includes('producto') && 'Producto: origen + marca + familia + tipología + género + artículo + color + talle.',
  ]
    .filter(Boolean)
    .join(' ')
}

const SHORT_VALUE = { cascos: 'Cascos', producto: 'Producto', ambos: 'Cascos y producto' }

/**
 * Formulario de "Altas de referencia": para qué marca, qué se crea y sus datos, con un ejemplo real al lado
 * de cada campo. Se usa en la sección propia y en la ventana que se abre desde la revisión del mail.
 */
export function AltaForm({ initial = {}, lockTarget = false, onSaved, onCancel, idPrefix = 'alta' }) {
  const firstTarget = getTarget(initial.targetId) ?? getTarget(DEFAULT_TARGET)
  const [brand, setBrand] = useState(() => initialBrand(firstTarget))
  const [targetId, setTargetId] = useState(firstTarget.id)
  const [values, setValues] = useState(() => startValues(firstTarget, initial.values, initialBrand(firstTarget, initial.values)))
  // Campos que la persona ya tocó, y si intentó guardar: solo entonces un campo vacío obligatorio se marca en rojo.
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState('')

  const target = getTarget(targetId) ?? firstTarget
  const isNewBrand = brand === NEW_BRAND
  const kinds = isNewBrand ? ['marca'] : kindsOfBrand(brand)
  const siblings = isNewBrand ? [target] : targetsOfBrand(brand).filter((item) => item.kind === target.kind)
  const suggested = target.codeLength ? suggestCode(target, values) : ''
  const example = exampleOf(target, values)

  // Validación en vivo: gris (sin datos), verde (se puede usar) o rojo (no se puede usar).
  const { errors: found } = validateAlta(target, values)
  const filled = (name) => String(values[name] ?? '').trim() !== ''
  const stateOf = (name) => {
    if (filled(name)) return found[name] ? 'invalid' : 'valid'
    return found[name] && (touched[name] || submitted) ? 'invalid' : 'neutral'
  }
  const blocked = Object.keys(found).length > 0
  const hasInvalidValue = Object.keys(found).some(filled)
  // Estos campos se controlan contra lo que ya existe: si están bien, se avisa que están disponibles.
  const checkedForDuplicates = ['codigo', 'descripcion', 'ingles']

  const switchTo = (nextBrand, nextTarget) => {
    setBrand(nextBrand)
    setTargetId(nextTarget.id)
    setValues(startValues(nextTarget))
    setTouched({})
    setSubmitted(false)
    setFormError('')
  }
  const chooseBrand = (next) => {
    if (next === NEW_BRAND) return switchTo(next, getTarget('marca'))
    const available = kindsOfBrand(next)
    const kind = available.includes(target.kind) ? target.kind : available[0]
    switchTo(next, targetsOfBrand(next).find((item) => item.kind === kind))
  }
  const chooseKind = (kind) => switchTo(brand, targetsOfBrand(brand).find((item) => item.kind === kind))
  const chooseTarget = (id) => switchTo(brand, getTarget(id))

  const setValue = (name, value) => {
    setValues((prev) => {
      const next = { ...prev, [name]: value }
      // La abreviatura de un color se sugiere mientras no la escriban a mano.
      if (name === 'descripcion' && target.suggest) {
        const before = target.suggest(prev).abreviatura ?? ''
        if (!prev.abreviatura || prev.abreviatura === before) next.abreviatura = target.suggest(next).abreviatura ?? ''
      }
      return next
    })
    setTouched((prev) => ({ ...prev, [name]: true }))
    setFormError('')
  }

  const submit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (blocked) return
    const result = createAlta(target.id, values)
    if (!result.ok) {
      setFormError(result.errors._ ?? 'No se pudo guardar el alta.')
      return
    }
    onSaved?.(result.entry)
  }

  return (
    <form className="alta-form" onSubmit={submit} noValidate>
      {!lockTarget && (
        <div className="alta-form__pick">
          <Field label="Marca" htmlFor={`${idPrefix}-pick-marca`} hint={isNewBrand ? 'Una marca que todavía no está en las tablas.' : brandHint(brand)}>
            <select id={`${idPrefix}-pick-marca`} className="input select" value={brand} onChange={(e) => chooseBrand(e.target.value)}>
              {BRANDS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
              <option value={NEW_BRAND}>Marca nueva…</option>
            </select>
          </Field>
          {!isNewBrand && (
            <Field label="Qué querés crear" htmlFor={`${idPrefix}-tipo`}>
              <select id={`${idPrefix}-tipo`} className="input select" value={target.kind} onChange={(e) => chooseKind(e.target.value)}>
                {kinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {KINDS[kind]}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {siblings.length > 1 && (
            <Field label="Para" htmlFor={`${idPrefix}-destino`}>
              <select id={`${idPrefix}-destino`} className="input select" value={target.id} onChange={(e) => chooseTarget(e.target.value)}>
                {siblings.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      )}
      {lockTarget && (
        <p className="muted small">
          {KINDS[target.kind]} · {target.label}
        </p>
      )}

      <p className="muted small alta-form__sheet">Se agregaría en la hoja «{target.sheet}» de CODIFICACION 2023.</p>

      <ExistingCases
        key={target.id}
        target={target}
        values={values}
        brandLabel={!lockTarget && !isNewBrand ? BRANDS.find((item) => item.id === brand)?.label : undefined}
        idPrefix={idPrefix}
      />

      <div className="alta-form__fields">
        <div className="alta-field alta-field--head" aria-hidden="true">
          <span>Datos a cargar</span>
          <span>Ejemplo de una fila existente</span>
        </div>
        {target.fields.map((field) => {
          const id = `${idPrefix}-${field.name}`
          const options = field.type === 'select' ? field.options() : null
          const sample = example[field.name]
          const state = stateOf(field.name)
          const stateClass = state === 'neutral' ? '' : `input--${state}`
          return (
            <div key={field.name} className="alta-field">
              <Field label={field.label} htmlFor={id} hint={field.hint} error={state === 'invalid' ? found[field.name] : undefined}>
                {options ? (
                  <select
                    id={id}
                    className={`input select ${stateClass}`}
                    aria-invalid={state === 'invalid' || undefined}
                    value={values[field.name] ?? ''}
                    onChange={(e) => setValue(field.name, e.target.value)}
                  >
                    <option value="">Elegí…</option>
                    {options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    className={`input ${field.mono ? 'input--mono' : ''} ${stateClass}`}
                    aria-invalid={state === 'invalid' || undefined}
                    value={values[field.name] ?? ''}
                    maxLength={field.name === 'codigo' && target.codeLength ? target.codeLength : undefined}
                    autoComplete="off"
                    onChange={(e) => setValue(field.name, e.target.value.toUpperCase())}
                  />
                )}
                {state === 'valid' && checkedForDuplicates.includes(field.name) && <p className="field__ok">✓ Disponible: no existe en la tabla.</p>}
                {field.name === 'codigo' && suggested && values.codigo !== suggested && (
                  <LinkButton icon="plus" onClick={() => setValue('codigo', suggested)}>
                    Usar el siguiente libre: {suggested}
                  </LinkButton>
                )}
              </Field>
              <div className="alta-example" data-field={field.name}>
                {sample ? (
                  <>
                    <span className="alta-example__label">Ej.:</span> <span className="mono">{SHORT_VALUE[sample] ?? sample}</span>
                  </>
                ) : (
                  <span className="muted">—</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {formError && <p className="field__error">{formError}</p>}
      <p className="alta-form__note">
        Queda <strong>pendiente de aceptar</strong>: se puede elegir, pero los SKU que la usen quedan bloqueados hasta que aceptes su creación.
      </p>

      <div className="alta-form__actions">
        <Button variant="success" icon="save" type="submit" disabled={blocked}>
          Guardar alta
        </Button>
        {blocked && (
          <span className={`small ${hasInvalidValue ? 'text-error' : 'muted'}`} role="status">
            {hasInvalidValue ? 'Corregí los datos marcados en rojo para poder guardar.' : 'Completá los datos obligatorios para poder guardar.'}
          </span>
        )}
        {onCancel && (
          <Button icon="close" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}
