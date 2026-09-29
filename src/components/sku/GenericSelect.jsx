import { GENERICOS_REPETIDOS } from '../../data/realData'
import { Field } from '../ui/Field'

const optionLabel = (generico) =>
  [generico.codigo, `${generico.tipologia} ${generico.modelo}`, generico.genero].filter(Boolean).join(' · ')

/** Selector de código genérico: la lista real de LS2 filtrada por familia. */
export function GenericSelect({ id, genericos, value, onChange }) {
  const selected = genericos.find((generico) => generico.key === value)
  const repeatedModels = selected ? GENERICOS_REPETIDOS.get(selected.codigo) : null

  return (
    <Field
      label="Código genérico"
      htmlFor={id}
      hint={`Obligatorio. ${genericos.length} genéricos de LS2 para esta familia.`}
    >
      <select id={id} className="input select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Elegí un genérico…</option>
        {genericos.map((generico) => (
          <option key={generico.key} value={generico.key}>
            {optionLabel(generico)}
            {GENERICOS_REPETIDOS.has(generico.codigo) ? ' (código repetido)' : ''}
          </option>
        ))}
      </select>
      {repeatedModels && (
        <p className="generic-warning" role="note">
          Este código genérico está asociado a más de un modelo ({repeatedModels.join(' y ')}). Es una inconsistencia de
          los datos reales para revisar con Andrés.
        </p>
      )}
    </Field>
  )
}
