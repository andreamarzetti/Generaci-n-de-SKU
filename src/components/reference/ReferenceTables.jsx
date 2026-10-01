import { useMemo, useState } from 'react'
import { BRANDS } from '../../engines/engines'
import { downloadTable, tableFileName } from '../../reference/exportReferences'
import { ALTA_STATUS, getAlta } from '../../reference/store'
import { appliesTo, familyNames, getTargets, KINDS, listRecords, tableColumns } from '../../reference/targets'
import { useAltas } from '../../reference/useAltas'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Field } from '../ui/Field'
import { AltaDialog } from './AltaDialog'

const MAX_ROWS = 400
const PLANTILLAS = { cascos: 'Cascos', producto: 'Producto', ambos: 'Cascos y producto', propio: 'Motor propio' }

/**
 * Explorador de las tablas de referencia tal como están hoy (CODIFICACION 2023 más las altas).
 * Se filtra por marca y familia, se busca, se agrega un dato a la tabla que se ve y se exporta completa.
 */
export function ReferenceTables() {
  const altas = useAltas()
  const [brand, setBrand] = useState('')
  const [family, setFamily] = useState('')
  const [kind, setKind] = useState('calota')
  const [targetId, setTargetId] = useState('calota-UBX')
  const [scope, setScope] = useState({})
  const [query, setQuery] = useState('')
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

  const needle = query.trim().toUpperCase()
  const filtered = needle
    ? records.filter(({ values }) => columns.some((field) => String(values[field.name] ?? '').toUpperCase().includes(needle)))
    : records
  const visible = filtered.slice(0, MAX_ROWS)

  const reset = () => {
    setScope({})
    setQuery('')
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

  const exportTable = async () => {
    try {
      await downloadTable(target, records)
      setFeedback(`Descargado: ${tableFileName(target)}`)
    } catch {
      setFeedback('No se pudo generar el archivo')
    }
    setTimeout(() => setFeedback(''), 2600)
  }

  const cell = (field, values) => (field.name === 'plantilla' ? (PLANTILLAS[values[field.name]] ?? values[field.name]) : (values[field.name] ?? '—'))
  const addInitial = { targetId: target?.id, values: { ...effectiveScope, ...(target?.kind === 'generico' ? { ...(brand && { marca: brand }), ...(family && { familia: family }) } : {}) } }

  return (
    <Card
      title="Tablas de referencia"
      aside={
        <div className="card__actions">
          <Button variant="primary" icon="plus" onClick={() => setAdding(true)} disabled={!scopeReady}>
            Agregar a esta tabla
          </Button>
          <Button icon="sheet" onClick={exportTable} disabled={records.length === 0}>
            Exportar esta tabla
          </Button>
        </div>
      }
    >
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
        {target && (
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
        {target && siblings.length > 1 && (
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
        {scopeFields.map((field) => (
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
        {target && (
          <Field label="Buscar" htmlFor="ref-buscar">
            <input id="ref-buscar" className="input" value={query} placeholder="Código o nombre" onChange={(e) => setQuery(e.target.value)} />
          </Field>
        )}
      </div>

      {!target ? (
        <p className="muted alta-list__note">No hay tablas de referencia para esa combinación de marca y familia.</p>
      ) : (
        <p className="muted small alta-list__note">
          {available.length} tablas para {brand || 'todas las marcas'} · {family || 'todas las familias'}. Hoja de origen: «{target.sheet}».{' '}
          {scopeReady ? `${filtered.length} de ${records.length} registros.` : 'Elegí el ámbito para ver la tabla.'}
          {filtered.length > MAX_ROWS && ` Se muestran los primeros ${MAX_ROWS}: buscá para acotar.`}
          {feedback && <strong> {feedback}.</strong>}
        </p>
      )}

      {target && scopeReady && (
        <div className="table-wrap reference-table">
          <table className="table table--compact">
            <thead>
              <tr>
                {columns.map((field) => (
                  <th key={field.name}>{field.label}</th>
                ))}
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ alta, values }, index) => {
                const status = alta ? getAlta(alta)?.status : null
                return (
                  <tr key={`${alta ?? 'base'}-${values.codigo ?? values.ingles}-${index}`} className={alta ? 'is-new' : ''}>
                    {columns.map((field) => (
                      <td key={field.name} className={field.name === 'codigo' ? 'mono strong' : ''}>
                        {cell(field, values)}
                      </td>
                    ))}
                    <td>
                      {alta ? (
                        <Badge tone={status === ALTA_STATUS.ACCEPTED ? 'ok' : 'warn'}>
                          {status === ALTA_STATUS.ACCEPTED ? 'Nueva · aceptada' : 'Nueva · pendiente'}
                        </Badge>
                      ) : (
                        <span className="muted">Existente</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="muted">
                    No hay registros{needle ? ' con esa búsqueda' : ''}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {adding && target && <AltaDialog lockTarget initial={addInitial} onClose={() => setAdding(false)} />}
    </Card>
  )
}
