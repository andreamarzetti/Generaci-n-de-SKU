import { GENERICOS_REPETIDOS } from '../../data/realData'
import { Field } from '../ui/Field'

const optionLabel = (generico) =>
  [generico.codigo, `${generico.tipologia} ${generico.modelo}`, generico.genero].filter(Boolean).join(' · ')

/** Selector de código genérico: la lista real filtrada por marca y familia, sin preselección. */
export function GenericSelect({ id, genericos, value, onChange, hint, emptyMessage }) {
  const selected = genericos.find((generico) => generico.key === value)
  const repeatedModels = selected ? GENERICOS_REPETIDOS.get(selected.codigo) : null
  const empty = genericos.length === 0

  return (
    <Field
      label="Código genérico"
      htmlFor={id}
      hint={hint ?? `Obligatorio. ${genericos.length} genéricos de LS2 para esta familia.`}
    >
      <select
        id={id}
        className="input select"
        value={value}
        disabled={empty}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{empty ? 'Sin genéricos disponibles' : 'Elegí un genérico…'}</option>
        {genericos.map((generico) => (
          <option key={generico.key} value={generico.key}>
            {optionLabel(generico)}
            {GENERICOS_REPETIDOS.has(generico.codigo) ? ' (código repetido)' : ''}
          </option>
        ))}
      </select>
      {empty && emptyMessage && (
        <p className="generic-warning" role="note">
          {emptyMessage}
        </p>
      )}
      {repeatedModels && (
        <p className="generic-warning" role="note">
          Este código genérico está asociado a más de un modelo ({repeatedModels.join(' y ')}). Es una inconsistencia de
          los datos reales para revisar con Andrés.
        </p>
      )}
    </Field>
  )
}
