import { ALL_GENERICOS, OFFICIAL_SIZES } from '../../data/realData'
import { BRANDS } from '../../engines/engines'
import { FAMILY_NAMES } from '../../parsing/catalogs'
import { field, missing, STATUS } from '../../parsing/normalize'
import { Button } from '../ui/Button'
import { DescriptionParts, VariantStatus } from './DescriptionParts'
import { StatusTag } from './StatusTag'
import { LinkButton } from '../ui/LinkButton'

const edited = (value) => ({ value, status: value ? STATUS.EDITED : STATUS.MISSING, reason: '' })
const digits = (value) => value.replace(/\D/g, '')
const SIZES = OFFICIAL_SIZES.filter((size) => size !== 'TU')

const genericLabel = (generico) =>
  [generico.codigo, `${generico.tipologia} ${generico.modelo}`, generico.genero].filter(Boolean).join(' · ')

/** Resumen editable de lo interpretado, antes de cargarlo en la pantalla. */
export function InterpretationSummary({ draft, onChange, onLoad, loadError, idPrefix = 'solicitud' }) {
  const { fields, rows, candidates, looseNumbers, variants = [] } = draft

  // Se pueden marcar una o varias variantes. Con una, se carga como siempre; con más de una,
  // se cargan juntas en la carga masiva, con una curva de talles para todas.
  const selected = draft.selected ?? []
  const multi = selected.length > 1
  const setSelected = (next) =>
    onChange({
      ...draft,
      selected: next,
      fields: {
        ...fields,
        descripcion:
          next.length === 1
            ? field(next[0], STATUS.DETECTED, 'Elegida entre las variantes del mail')
            : missing(
                next.length > 1
                  ? `Se cargan ${next.length} variantes juntas`
                  : `El mail pide ${variants.length} variantes: marcá cuáles cargar`,
              ),
      },
    })
  const toggleVariant = (variant) =>
    setSelected(variants.filter((item) => (item === variant ? !selected.includes(item) : selected.includes(item))))
  const allSelected = variants.length > 0 && selected.length === variants.length

  // Curva de talles de la carga masiva: la que se marque acá o, si no, los talles de la tabla.
  const curve = draft.curve ?? rows.map((row) => row.talle.value).filter(Boolean)
  const toggleCurve = (size) =>
    onChange({ ...draft, curve: SIZES.filter((item) => (item === size ? !curve.includes(item) : curve.includes(item))) })
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
        position === index ? { ...row, [target]: edited(number), unresolved: row.unresolved.filter((item) => item !== number) } : row,
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
      {variants.length > 1 && (
        <div className="variants" role="group" aria-label="Variantes pedidas en el mail">
          <p className="variants__title">
            El mail pide {variants.length} variantes. Marcá una o varias: con más de una se cargan juntas en la carga masiva, con una curva
            de talles para todas. El mail no indica talles: se eligen más abajo.
          </p>
          <div className="variants__toolbar">
            <label className="checkbox variants__all">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(element) => {
                  if (element) element.indeterminate = selected.length > 0 && !allSelected
                }}
                onChange={() => setSelected(allSelected ? [] : [...variants])}
              />
              Seleccionar todas
            </label>
            <span className="muted small">
              {selected.length} de {variants.length} {selected.length === 1 ? 'marcada' : 'marcadas'}
            </span>
          </div>
          <ul className="variants__list">
            {variants.map((variant) => {
              const checked = selected.includes(variant)
              return (
                <li key={variant} className={`variants__item ${checked ? 'variants__item--selected' : ''}`}>
                  <label className="variants__label">
                    <input type="checkbox" checked={checked} onChange={() => toggleVariant(variant)} />
                    <span className="variants__name">{variant}</span>
                  </label>
                  <VariantStatus brandId={fields.marca.value} description={variant} />
                </li>
              )
            })}
          </ul>
        </div>
      )}

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

      <DescriptionParts draft={draft} onChange={onChange} />

      {multi && (
        <div className="field" id={`${idPrefix}-curva`}>
          <span className="field__label">Curva de talles para todas las variantes</span>
          <div className="size-picker" role="group" aria-label="Curva de talles">
            {SIZES.map((size) => (
              <button
                key={size}
                type="button"
                aria-pressed={curve.includes(size)}
                className={`size-chip ${curve.includes(size) ? 'is-active' : ''}`}
                onClick={() => toggleCurve(size)}
              >
                {size}
              </button>
            ))}
          </div>
          <p className="field__hint">
            Después de cargar podés cambiar los talles de una variante en particular. El código de barras y el EAN se completan por SKU.
          </p>
        </div>
      )}

      {!multi && (
        <>
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
                            <LinkButton key={`${name}-${number}`} tone="success" icon="check" className="unresolved" onClick={() => assignNumber(index, number, name)}>
                              Usar {number}
                            </LinkButton>
                          ))}
                      </td>
                    ))}
                    <td>
                      <LinkButton tone="danger" icon="trash" onClick={() => removeRow(index)} aria-label={`Quitar la fila ${index + 1}`}>
                        Quitar
                      </LinkButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <LinkButton tone="success" icon="plus" onClick={addRow}>
            Agregar talle
          </LinkButton>
        </>
      )}

      {looseNumbers.length > 0 && (
        <p className="generic-warning" role="note">
          Números de 13 dígitos sin talle asociado: {looseNumbers.join(', ')}. Copialos en la fila que corresponda.
        </p>
      )}

      <div className="interpretation__actions">
        <Button variant="primary" iconRight="load" onClick={onLoad}>
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
