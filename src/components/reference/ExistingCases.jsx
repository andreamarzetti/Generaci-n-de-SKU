import { useMemo, useState } from 'react'
import { BRANDS } from '../../engines/engines'
import { brandsOf, KINDS, listRecords, repeatedCodes, searchRecords, tableColumns } from '../../reference/targets'
import { useAltas } from '../../reference/useAltas'
import { Icon } from '../ui/Icon'
import { LinkButton } from '../ui/LinkButton'
import { RecordsTable } from './RecordsTable'

const upper = (value) =>
  String(value ?? '')
    .trim()
    .toUpperCase()

/**
 * Barra de búsqueda de los casos que ya existen en la tabla donde se está cargando un alta, con los filtros
 * elegidos a la vista (marca, tipo, tabla, familia…). Sirve para consultar a mano antes de cargar: si se
 * escribe en el formulario un código o nombre que ya existe, esa fila se marca en rojo.
 */
export function ExistingCases({ target, values, brandLabel, idPrefix = 'alta' }) {
  const altas = useAltas()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const scope = Object.fromEntries(target.scopeFields.map((field) => [field.name, values[field.name] ?? '']))
  const scopeReady = target.scopeFields.every((field) => !field.required || scope[field.name])
  const scopeKey = JSON.stringify(scope)
  // `altas` cambia al crear o quitar una: hay que volver a leer la tabla.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const records = useMemo(() => (scopeReady ? listRecords(target, scope) : []), [target.id, scopeKey, scopeReady, altas])
  const columns = tableColumns(target)
  const found = searchRecords(records, columns, query)
  const repeated = useMemo(() => repeatedCodes(records), [records])

  const searching = query.trim() !== ''
  const expanded = open || searching

  const owners = brandsOf(target)
  const brandName = brandLabel ?? (owners?.length === 1 ? (BRANDS.find((brand) => brand.id === owners[0])?.label ?? owners[0]) : null)
  const filters = [
    brandName && ['Marca', brandName],
    ['Tipo', KINDS[target.kind]],
    ['Tabla', target.label],
    ...target.scopeFields.filter((field) => scope[field.name]).map((field) => [field.label, scope[field.name]]),
  ].filter(Boolean)

  // Lo que se está escribiendo en el formulario: si ya existe, esa fila se marca.
  const typed = { code: upper(values.codigo), name: upper(values.descripcion), english: upper(values.ingles) }
  const highlight = (row) =>
    Boolean(
      (typed.code && row.codigo === typed.code) ||
      (typed.name && row.descripcion === typed.name) ||
      (typed.english && row.ingles === typed.english),
    )

  const toggle = () => {
    if (expanded) {
      setOpen(false)
      setQuery('')
    } else {
      setOpen(true)
    }
  }

  return (
    <section className="existing" aria-label="Buscar casos existentes">
      <div className="existing__filters" aria-label="Filtros seleccionados">
        {filters.map(([label, value]) => (
          <span key={label} className="existing__chip">
            <span className="existing__chip-label">{label}:</span> {value}
          </span>
        ))}
      </div>

      <div className="existing__bar">
        <label className="existing__search" htmlFor={`${idPrefix}-buscar-existentes`}>
          <Icon name="search" />
          <span className="sr-only">Buscar un caso existente</span>
          <input
            id={`${idPrefix}-buscar-existentes`}
            type="search"
            className="input input--sm"
            placeholder="Buscar un caso existente (código o nombre)"
            autoComplete="off"
            disabled={!scopeReady}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <LinkButton icon={expanded ? 'chevronUp' : 'chevronDown'} aria-expanded={expanded} onClick={toggle}>
          {expanded ? 'Ocultar casos' : `Ver todos${scopeReady ? ` (${records.length})` : ''}`}
        </LinkButton>
      </div>

      {expanded &&
        (scopeReady ? (
          <>
            <p className="muted small">
              {found.length} de {records.length} {records.length === 1 ? 'caso' : 'casos'} en esta tabla.
            </p>
            <RecordsTable
              columns={columns}
              records={found}
              max={200}
              searching={searching}
              className="existing__table"
              highlight={highlight} repeated={repeated}
            />
          </>
        ) : (
          <p className="muted small">
            Elegí{' '}
            {target.scopeFields
              .filter((field) => field.required)
              .map((field) => field.label.toLowerCase())
              .join(' y ')}{' '}
            para ver los casos de esta tabla.
          </p>
        ))}
    </section>
  )
}
