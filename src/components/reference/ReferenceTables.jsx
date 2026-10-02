import { useMemo, useState } from 'react'
import { BRANDS } from '../../engines/engines'
import { downloadDuplicates, downloadTable, duplicatesFileName, tableFileName } from '../../reference/exportReferences'
import { appliesTo, duplicateCases, familyNames, getTarget, getTargets, KINDS, listRecords, repeatedCodes, searchRecords, tableColumns } from '../../reference/targets'
import { useAltas } from '../../reference/useAltas'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Field } from '../ui/Field'
import { Icon } from '../ui/Icon'
import { AltaDialog } from './AltaDialog'
import { RecordsTable } from './RecordsTable'

const MAX_ROWS = 400

/** Las filas de la tabla que usan el código repetido, para verlas debajo del caso. */
function CaseDetail({ item }) {
  const altas = useAltas()
  const target = getTarget(item.targetId)
  // `altas` cambia al crear o quitar una: hay que volver a leer la tabla.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const records = useMemo(() => listRecords(target, item.scope).filter(({ values }) => values.codigo === item.codigo), [item.id, altas])
  return <RecordsTable columns={tableColumns(target)} records={records} className="dup__detail-table" />
}

/**
 * Explorador de las tablas de referencia tal como están hoy (CODIFICACION 2023 más las altas).
 * Dos vistas con los mismos filtros de marca y familia:
 *  - «Una tabla»: se busca, se ven los códigos repetidos, se agrega un dato y se exporta la tabla completa.
 *  - «Códigos repetidos»: todos los códigos que sirven a más de un nombre, de todas las tablas.
 */
export function ReferenceTables() {
  const altas = useAltas()
  const [mode, setMode] = useState('tabla')
  const [brand, setBrand] = useState('')
  const [family, setFamily] = useState('')
  const [kind, setKind] = useState('calota')
  const [targetId, setTargetId] = useState('calota-UBX')
  const [scope, setScope] = useState({})
  const [query, setQuery] = useState('')
  const [onlyRepeated, setOnlyRepeated] = useState(false)
  // Códigos repetidos desplegados (se ve el detalle debajo del caso).
  const [expandedCases, setExpandedCases] = useState(() => new Set())
  const [adding, setAdding] = useState(false)
  const [feedback, setFeedback] = useState('')

  // Tablas que corresponden a la marca y familia elegidas.
  const available = getTargets().filter((item) => appliesTo(item, { brand, family }))
  const kinds = Object.keys(KINDS).filter((value) => available.some((item) => item.kind === value))
  const activeKind = kinds.includes(kind) ? kind : kinds[0]
  const siblings = available.filter((item) => item.kind === activeKind)
  const target = siblings.find((item) => item.id === targetId) ?? siblings[0]

  // La familia elegida arriba ya define el ámbito de las tablas "por familia" (ej.: tipologías de producto).
  const scopeFromFilter = family && target?.scopeFields.some((field) => field.name === 'familia') ? { familia: family } : {}
  const effectiveScope = { ...scope, ...scopeFromFilter }
  const scopeFields = target ? target.scopeFields.filter((field) => !(field.name in scopeFromFilter)) : []
  const scopeReady = Boolean(target) && !target.scopeFields.some((field) => field.required && !effectiveScope[field.name])
  const columns = target ? tableColumns(target) : []

  // `altas` cambia al crear, aceptar o quitar: hay que volver a leer las tablas.
  const scopeKey = JSON.stringify(effectiveScope)
  const records = useMemo(() => {
    if (!target) return []
    const all = listRecords(target, effectiveScope)
    // Los genéricos de todas las marcas se acotan por marca y familia; el resto ya es de un ámbito.
    return target.kind === 'generico'
      ? all.filter(({ values }) => (!brand || values.marca === brand) && (!family || values.familia === family))
      : all
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id, scopeKey, brand, family, altas])
  // Los códigos genéricos no se cargan como dato de referencia (se crean al generar el SKU): no se marcan repetidos.
  const repeated = useMemo(() => (target?.kind === 'generico' ? new Set() : repeatedCodes(records)), [records, target?.kind])
  const shown = onlyRepeated ? records.filter(({ values }) => repeated.has(values.codigo)) : records

  // Códigos repetidos de todas las tablas que corresponden a la marca y familia elegidas.
  const cases = useMemo(() => duplicateCases({ brand, family }), [brand, family, altas])
  const needle = query.trim().toUpperCase()
  const filteredCases = needle
    ? cases.filter((item) => [item.tabla, item.ambito, item.codigo, ...item.nombres].some((text) => String(text).toUpperCase().includes(needle)))
    : cases
  const tablesWithCases = new Set(cases.map((item) => `${item.targetId}|${item.ambito}`)).size
  const conflicts = cases.filter((item) => item.conflicto).length

  const filtered = searchRecords(shown, columns, query)

  const reset = () => {
    setScope({})
    setQuery('')
    setOnlyRepeated(false)
  }
  const chooseMode = (next) => {
    setMode(next)
    setQuery('')
    setOnlyRepeated(false)
  }
  const chooseKind = (next) => {
    setKind(next)
    setTargetId('')
    reset()
  }
  const chooseTarget = (id) => {
    setTargetId(id)
    reset()
  }
  const toggleCase = (id) =>
    setExpandedCases((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const flash = (message) => {
    setFeedback(message)
    setTimeout(() => setFeedback(''), 2600)
  }
  const exportTable = async () => {
    try {
      await downloadTable(target, records)
      flash(`Descargado: ${tableFileName(target)}`)
    } catch {
      flash('No se pudo generar el archivo')
    }
  }
  const exportDuplicates = async () => {
    try {
      await downloadDuplicates(filteredCases)
      flash(`Descargado: ${duplicatesFileName()}`)
    } catch {
      flash('No se pudo generar el archivo')
    }
  }

  const addInitial = { targetId: target?.id, values: effectiveScope }

  return (
    <Card
      title="Tablas de referencia"
      aside={
        <div className="card__actions">
          {mode === 'tabla' ? (
            <>
              <Button
                variant="primary"
                icon="plus"
                onClick={() => setAdding(true)}
                disabled={!scopeReady || target?.readOnly}
                title={target?.readOnly ? target.readOnlyNote : undefined}
              >
                Agregar a esta tabla
              </Button>
              <Button icon="sheet" onClick={exportTable} disabled={records.length === 0}>
                Exportar esta tabla
              </Button>
            </>
          ) : (
            <Button icon="sheet" onClick={exportDuplicates} disabled={filteredCases.length === 0}>
              Exportar repetidos
            </Button>
          )}
        </div>
      }
    >
      <div className="tabs reference-modes" role="tablist" aria-label="Qué ver">
        <button type="button" role="tab" aria-selected={mode === 'tabla'} className={`tabs__tab ${mode === 'tabla' ? 'is-active' : ''}`} onClick={() => chooseMode('tabla')}>
          Una tabla
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'repetidos'}
          className={`tabs__tab ${mode === 'repetidos' ? 'is-active' : ''}`}
          onClick={() => chooseMode('repetidos')}
        >
          Códigos repetidos ({cases.length})
        </button>
      </div>

      <div className="alta-form__pick">
        <Field label="Marca" htmlFor="ref-marca">
          <select id="ref-marca" className="input select" value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="">Todas</option>
            {BRANDS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Familia" htmlFor="ref-familia-filtro">
          <select id="ref-familia-filtro" className="input select" value={family} onChange={(e) => setFamily(e.target.value)}>
            <option value="">Todas</option>
            {familyNames().map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        {mode === 'tabla' && target && (
          <Field label="Tabla" htmlFor="ref-tipo">
            <select id="ref-tipo" className="input select" value={activeKind} onChange={(e) => chooseKind(e.target.value)}>
              {kinds.map((value) => (
                <option key={value} value={value}>
                  {value === 'marca' ? 'Marcas' : KINDS[value]}
                </option>
              ))}
            </select>
          </Field>
        )}
        {mode === 'tabla' && target && siblings.length > 1 && (
          <Field label="Para" htmlFor="ref-destino">
            <select id="ref-destino" className="input select" value={target.id} onChange={(e) => chooseTarget(e.target.value)}>
              {siblings.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {mode === 'tabla' &&
          scopeFields.map((field) => (
            <Field key={field.name} label={field.label} htmlFor={`ref-${field.name}`}>
              <select
                id={`ref-${field.name}`}
                className="input select"
                value={scope[field.name] ?? ''}
                onChange={(e) => setScope({ ...scope, [field.name]: e.target.value })}
              >
                <option value="">Elegí…</option>
                {field.options().map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        {(mode === 'repetidos' || target) && (
          <Field label="Buscar" htmlFor="ref-buscar">
            <input
              id="ref-buscar"
              className="input"
              value={query}
              placeholder={mode === 'repetidos' ? 'Código, nombre o tabla' : 'Código o nombre'}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
        )}
      </div>

      {mode === 'repetidos' ? (
        <>
          <p className="muted small alta-list__note">
            {cases.length === 0
              ? `No hay códigos repetidos para ${brand || 'todas las marcas'} · ${family || 'todas las familias'}.`
              : `${cases.length} ${cases.length === 1 ? 'código repetido' : 'códigos repetidos'} en ${tablesWithCases} ${tablesWithCases === 1 ? 'tabla' : 'tablas'} para ${brand || 'todas las marcas'} · ${family || 'todas las familias'}: ${conflicts} con nombres distintos (dos productos podrían quedar con el mismo código) y ${cases.length - conflicts} con el mismo nombre repetido. ${filteredCases.length} de ${cases.length} a la vista.`}
            {feedback && <strong> {feedback}.</strong>}
          </p>
          {cases.length > 0 && (
            <div className="table-wrap reference-table dup-table">
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th className="dup__chev">
                      <span className="sr-only">Detalle</span>
                    </th>
                    <th>Código</th>
                    <th>Nombres que lo usan</th>
                    <th>Tabla</th>
                    <th>Situación</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.slice(0, MAX_ROWS).flatMap((item, index) => {
                    const open = expandedCases.has(item.id)
                    const detailId = `dup-detalle-${index}`
                    const row = (
                      <tr key={item.id} className={`dup__case ${open ? 'is-open' : ''}`}>
                        <td className="dup__chev">
                          <button
                            type="button"
                            className="dup__toggle"
                            aria-expanded={open}
                            aria-controls={open ? detailId : undefined}
                            aria-label={`${open ? 'Ocultar' : 'Ver'} el detalle del código ${item.codigo}`}
                            onClick={() => toggleCase(item.id)}
                          >
                            <Icon name={open ? 'chevronDown' : 'chevronRight'} />
                          </button>
                        </td>
                        <td className="mono strong">{item.codigo}</td>
                        <td className="dup__names">{item.nombres.join(' / ')}</td>
                        <td className="dup__tabla">
                          {item.tabla}
                          {item.ambito && <span className="muted"> · {item.ambito}</span>}
                        </td>
                        <td>
                          <Badge tone={item.conflicto ? 'error' : 'neutral'}>
                            {item.conflicto ? `${item.nombres.length} nombres distintos` : `Mismo nombre · ${item.veces} veces`}
                          </Badge>
                        </td>
                      </tr>
                    )
                    return open
                      ? [
                          row,
                          <tr key={`${item.id}-detalle`} id={detailId} className="dup__detail">
                            <td colSpan={5}>
                              <CaseDetail item={item} />
                            </td>
                          </tr>,
                        ]
                      : [row]
                  })}
                  {filteredCases.length === 0 && (
                    <tr>
                      <td colSpan={5} className="muted">
                        No hay códigos repetidos con esa búsqueda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          {!target ? (
            <p className="muted alta-list__note">No hay tablas de referencia para esa combinación de marca y familia.</p>
          ) : (
            <p className="muted small alta-list__note">
              {available.length} tablas para {brand || 'todas las marcas'} · {family || 'todas las familias'}. Hoja de origen: «{target.sheet}».{' '}
              {scopeReady ? `${filtered.length} de ${records.length} registros.` : 'Elegí el ámbito para ver la tabla.'}
              {scopeReady && repeated.size > 0 && ` ${repeated.size} ${repeated.size === 1 ? 'código repetido' : 'códigos repetidos'} en esta tabla.`}
              {filtered.length > MAX_ROWS && ` Se muestran los primeros ${MAX_ROWS}: buscá para acotar.`}
              {target.readOnly && <strong> {target.readOnlyNote}</strong>}
              {feedback && <strong> {feedback}.</strong>}
            </p>
          )}

          {target && scopeReady && repeated.size > 0 && (
            <label className="checkbox reference-only-repeated">
              <input type="checkbox" id="ref-solo-repetidos" checked={onlyRepeated} onChange={(e) => setOnlyRepeated(e.target.checked)} />
              Mostrar solo los códigos repetidos de esta tabla
            </label>
          )}

          {target && scopeReady && (
            <RecordsTable columns={columns} records={filtered} max={MAX_ROWS} searching={Boolean(needle)} repeated={repeated} />
          )}
        </>
      )}

      {adding && target && <AltaDialog lockTarget initial={addInitial} onClose={() => setAdding(false)} />}
    </Card>
  )
}
