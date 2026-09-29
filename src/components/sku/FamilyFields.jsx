import { normalizeSize } from '../../rules/sizes'
import { Field } from '../ui/Field'

/** Renderiza los campos definidos en rules/families.js. Todo se normaliza a mayúsculas. */
export function FamilyFields({ idPrefix, fields, form, onChange }) {
  return fields.map((field) => {
    const id = `${idPrefix}-${field.name}`
    const Input = INPUTS[field.type]
    return <Input key={id} id={id} field={field} value={form[field.name]} onChange={(next) => onChange(field.name, next)} />
  })
}

function TextInput({ id, field, value, onChange }) {
  return (
    <Field label={field.label} htmlFor={id} hint={field.hint}>
      <input
        id={id}
        className="input"
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
      />
    </Field>
  )
}

function CodeInput({ id, field, value, onChange }) {
  return (
    <Field label={field.label} htmlFor={id} hint={field.hint}>
      <input
        id={id}
        className="input input--mono"
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/\s+/g, ''))}
      />
    </Field>
  )
}

function SizesInput({ id, field, value, onChange }) {
  const received = value.map(normalizeSize)
  const isActive = (size) => received.some((item) => item.value === size)
  const toggle = (size) =>
    onChange(isActive(size) ? value.filter((raw) => normalizeSize(raw).value !== size) : [...value, size])
  const normalized = received.filter((item) => item.normalized)

  return (
    <Field label={field.label} htmlFor={id} hint={field.hint}>
      <div id={id} className="size-picker" role="group" aria-label={field.label}>
        {field.options.map((size) => (
          <button
            key={size}
            type="button"
            aria-pressed={isActive(size)}
            className={`size-chip ${isActive(size) ? 'is-active' : ''}`}
            onClick={() => toggle(size)}
          >
            {size}
          </button>
        ))}
      </div>
      {normalized.length > 0 && (
        <p className="size-note">
          Normalizado según la tabla oficial:{' '}
          {normalized.map((item) => `${item.raw} → ${item.value}`).join(' · ')}
        </p>
      )}
    </Field>
  )
}

function LinesInput({ id, field, value, onChange }) {
  const count = value.split('\n').filter((line) => line.trim()).length
  return (
    <Field
      label={field.label}
      htmlFor={id}
      hint={field.hint}
      counter={<span className="field__counter">{count} códigos</span>}
    >
      <textarea
        id={id}
        className="input input--mono textarea"
        rows={6}
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
      />
    </Field>
  )
}

const INPUTS = {
  text: TextInput,
  code: CodeInput,
  sizes: SizesInput,
  lines: LinesInput,
}
