import { ALL_GENERICOS, OFFICIAL_SIZES } from '../../data/realData'
import { BRANDS } from '../../engines/engines'
import { FAMILY_NAMES } from '../../parsing/catalogs'
import { STATUS } from '../../parsing/normalize'
import { Button } from '../ui/Button'
import { StatusTag } from './StatusTag'

const edited = (value) => ({ value, status: value ? STATUS.EDITED : STATUS.MISSING, reason: '' })
const digits = (value) => value.replace(/\D/g, '')
const SIZES = OFFICIAL_SIZES.filter((size) => size !== 'TU')

const genericLabel = (generico) =>
  [generico.codigo, `${generico.tipologia} ${generico.modelo}`, generico.genero].filter(Boolean).join(' · ')

/** Resumen editable de lo interpretado, antes de cargarlo en la pantalla. */
export function InterpretationSummary({ draft, onChange, onLoad, loadError, idPrefix = 'solicitud' }) {
  const { fields, rows, candidates, looseNumbers } = draft

  const setField = (name, value) => onChange({ ...draft, fields: { ...fields, [name]: { ...fields[name], ...edited(value) } } })
  const setRow = (index, name, value) =>
    onChange({
      ...draft,
      rows: rows.map((row, position) => (position === index ? { ...row, [name]: edited(value) } : row)),
    })
  const assignNumber = (index, number, target) =>
    onChange({
      ...draft,
      rows: rows.map((row, position) =>
        position === index
          ? { ...row, [target]: edited(number), unresolved: row.unresolved.filter((item) => item !== number) }
          : row,
      ),
    })
  const removeRow = (index) => onChange({ ...draft, rows: rows.filter((_, position) => position !== index) })
  const addRow = () =>
    onChange({
      ...draft,
      rows: [
        ...rows,
        { talle: edited(''), talleRecibido: '', barras: edited(''), ean: edited(''), codigoProveedor: edited(''), unresolved: [] },
      ],
    })

  // Genéricos para elegir: los candidatos del modelo, o los de la marca y familia.
  const genericOptions = candidates.length
    ? candidates
    : ALL_GENERICOS.filter(
        (generico) =>
          fields.marca.value &&
          generico.marca === fields.marca.value &&
          (!fields.familia.value || generico.familia === fields.familia.value),
      )
  const brandCandidates = fields.marca.candidates ?? []

  return (
    <div className="interpretation">
      <div className="interpretation__grid">
        <SummaryField id={`${idPrefix}-marca`} label="Marca" field={fields.marca}>
          <select
            id={`${idPrefix}-marca`}
            className="input select"
            value={fields.marca.value}
            onChange={(e) => setField('marca', e.target.value)}
          >
            <option value="">{brandCandidates.length > 1 ? 'Elegí entre las marcas mencionadas…' : 'Completar…'}</option>
            {BRANDS.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.label}
                {brandCandidates.includes(brand.id) ? ' (mencionada)' : ''}
              </option>
            ))}
          </select>
        </SummaryField>

        <SummaryField id={`${idPrefix}-familia`} label="Familia" field={fields.familia}>
          <select
            id={`${idPrefix}-familia`}
            className="input select"
            value={fields.familia.value}
            onChange={(e) => setField('familia', e.target.value)}
          >
            <option value="">Completar…</option>
            {FAMILY_NAMES.map((family) => (
              <option key={family.familia} value={family.familia}>
                {family.familia}
              </option>
            ))}
          </select>
        </SummaryField>

        <SummaryField
          id={`${idPrefix}-generico`}
          label="Código genérico"
          field={fields.generico}
          wide
          note={
            candidates.length > 1 && !fields.generico.value
              ? `Hay ${candidates.length} genéricos posibles para el modelo. Elegí uno: no se preselecciona.`
              : null
          }
        >
          <select
            id={`${idPrefix}-generico`}
            className="input select"
            value={fields.generico.value}
            onChange={(e) => setField('generico', e.target.value)}
          >
            <option value="">{genericOptions.length ? 'Elegí un genérico…' : 'Completá marca y familia'}</option>
            {genericOptions.map((generico) => (
              <option key={generico.key} value={generico.codigo}>
                {genericLabel(generico)}
              </option>
            ))}
          </select>
        </SummaryField>

        <SummaryField id={`${idPrefix}-descripcion`} label="Descripción" field={fields.descripcion} wide>
          <input
            id={`${idPrefix}-descripcion`}
            className="input"
            value={fields.descripcion.value}
            placeholder="Completar"
            onChange={(e) => setField('descripcion', e.target.value.toUpperCase())}
          />
        </SummaryField>
      </div>

      <div className="table-wrap">
        <table className="table table--compact interpretation__table">
          <thead>
            <tr>
              <th>Talle</th>
              <th>Código de barras</th>
              <th>EAN</th>
              <th>Código proveedor</th>
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${index}-${row.talle.value}`}>
                <td>
                  <div className="cell-edit">
                    <select
                      aria-label={`Talle, fila ${index + 1}`}
                      className="input input--sm select"
                      value={row.talle.value}
                      onChange={(e) => setRow(index, 'talle', e.target.value)}
                    >
                      <option value="">—</option>
                      {SIZES.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                    <StatusTag status={row.talle.status} reason={row.talle.reason} />
                  </div>
                </td>
                {['barras', 'ean', 'codigoProveedor'].map((name) => (
                  <td key={name}>
                    <div className="cell-edit">
                      <input
                        aria-label={`${name === 'codigoProveedor' ? 'Código proveedor' : name === 'ean' ? 'EAN' : 'Código de barras'}, talle ${row.talle.value || index + 1}`}
                        className="input input--mono input--sm"
                        value={row[name].value}
                        placeholder="Completar"
                        onChange={(e) =>
                          setRow(index, name, name === 'codigoProveedor' ? e.target.value.toUpperCase() : digits(e.target.value))
                        }
                      />
                      <StatusTag status={row[name].status} reason={row[name].reason} />
                    </div>
                    {name !== 'codigoProveedor' &&
                      row.unresolved.map((number) => (
                        <button
                          key={`${name}-${number}`}
                          type="button"
                          className="link-button unresolved"
                          onClick={() => assignNumber(index, number, name)}
                        >
                          Usar {number}
                        </button>
                      ))}
                  </td>
                ))}
                <td>
                  <button type="button" className="link-button" onClick={() => removeRow(index)} aria-label={`Quitar la fila ${index + 1}`}>
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="link-button" onClick={addRow}>
        + Agregar talle
      </button>

      {looseNumbers.length > 0 && (
        <p className="generic-warning" role="note">
          Números de 13 dígitos sin talle asociado: {looseNumbers.join(', ')}. Copialos en la fila que corresponda.
        </p>
      )}

      <div className="interpretation__actions">
        <Button variant="primary" onClick={onLoad}>
          Cargar en la pantalla
        </Button>
        {loadError && <span className="small text-error">{loadError}</span>}
      </div>
    </div>
  )
}

function SummaryField({ id, label, field, note, wide = false, children }) {
  return (
    <div className={`field ${wide ? 'interpretation__wide' : ''}`}>
      <div className="field__top">
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        <StatusTag status={field.status} reason={field.reason} />
      </div>
      {children}
      {note && <p className="field__hint text-warn">{note}</p>}
    </div>
  )
}
