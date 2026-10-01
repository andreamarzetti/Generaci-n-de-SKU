import { useState } from 'react'
import { createAlta } from '../../reference/store'
import { getTarget, KINDS, suggestCode, targetsOfKind } from '../../reference/targets'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { LinkButton } from '../ui/LinkButton'

const DEFAULT_TARGET = 'calota-UBX'

/** Valores iniciales de un destino: lo que se pasó más el código sugerido (si la tabla lo permite). */
function startValues(target, values = {}) {
  const suggested = target.codeLength ? suggestCode(target, values) : ''
  return { ...(suggested ? { codigo: suggested } : {}), ...values }
}

/**
 * Formulario de "Altas de referencia": qué se crea, para qué marca o tabla, y sus datos.
 * Se usa en la sección propia y en la ventana que se abre desde la revisión del mail.
 */
export function AltaForm({ initial = {}, lockTarget = false, onSaved, onCancel, idPrefix = 'alta' }) {
  const firstTarget = getTarget(initial.targetId) ?? getTarget(DEFAULT_TARGET)
  const [targetId, setTargetId] = useState(firstTarget.id)
  const [values, setValues] = useState(() => startValues(firstTarget, initial.values))
  const [errors, setErrors] = useState({})

  const target = getTarget(targetId) ?? firstTarget
  const siblings = targetsOfKind(target.kind)
  const suggested = target.codeLength ? suggestCode(target, values) : ''

  const chooseKind = (kind) => chooseTarget(targetsOfKind(kind)[0].id)
  const chooseTarget = (id) => {
    setTargetId(id)
    setValues(startValues(getTarget(id)))
    setErrors({})
  }

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
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const submit = (event) => {
    event.preventDefault()
    const result = createAlta(target.id, values)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    onSaved?.(result.entry)
  }

  return (
    <form className="alta-form" onSubmit={submit} noValidate>
      {!lockTarget && (
        <div className="alta-form__pick">
          <Field label="Qué querés crear" htmlFor={`${idPrefix}-tipo`}>
            <select id={`${idPrefix}-tipo`} className="input select" value={target.kind} onChange={(e) => chooseKind(e.target.value)}>
              {Object.entries(KINDS).map(([kind, label]) => (
                <option key={kind} value={kind}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
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

      <div className="alta-form__fields">
        {target.fields.map((field) => {
          const id = `${idPrefix}-${field.name}`
          const options = field.type === 'select' ? field.options() : null
          return (
            <Field key={field.name} label={field.label} htmlFor={id} hint={field.hint} error={errors[field.name]}>
              {options ? (
                <select id={id} className="input select" value={values[field.name] ?? ''} onChange={(e) => setValue(field.name, e.target.value)}>
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
                  className={`input ${field.mono ? 'input--mono' : ''}`}
                  value={values[field.name] ?? ''}
                  maxLength={field.name === 'codigo' && target.codeLength ? target.codeLength : undefined}
                  autoComplete="off"
                  onChange={(e) => setValue(field.name, e.target.value.toUpperCase())}
                />
              )}
              {field.name === 'codigo' && suggested && values.codigo !== suggested && (
                <LinkButton icon="plus" onClick={() => setValue('codigo', suggested)}>
                  Usar el siguiente libre: {suggested} </LinkButton>
              )}
            </Field>
          )
        })}
      </div>

      {errors._ && <p className="field__error">{errors._}</p>}
      <p className="alta-form__note">
        Queda <strong>pendiente de aceptar</strong>: se puede elegir, pero los SKU que la usen quedan bloqueados hasta que aceptes su creación.
      </p>

      <div className="alta-form__actions">
        <Button variant="success" icon="save" type="submit">
          Guardar alta
        </Button>
        {onCancel && (
          <Button icon="close" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}
