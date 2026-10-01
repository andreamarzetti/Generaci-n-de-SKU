import { useMemo, useState } from 'react'
import { applyChoices, COMPONENT_STATUS, decomposeDescription, summarizeParts } from '../../parsing/components'
import { isPendingAlta } from '../../reference/store'
import { useAltas } from '../../reference/useAltas'
import { AltaDialog } from '../reference/AltaDialog'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'

const STATUS_BADGE = {
  [COMPONENT_STATUS.FOUND]: { tone: 'ok', label: 'Existe' },
  [COMPONENT_STATUS.DEDUCED]: { tone: 'warn', label: 'Deducido' },
  [COMPONENT_STATUS.AMBIGUOUS]: { tone: 'warn', label: 'Elegir' },
  [COMPONENT_STATUS.NEW]: { tone: 'error', label: 'No existe' },
  [COMPONENT_STATUS.MISSING]: { tone: 'neutral', label: 'Falta' },
}

/** Partes de la descripción de una variante, con las elecciones del usuario aplicadas. */
export function usePartsOf(brandId, description, choices) {
  const altas = useAltas()
  // `altas` cambia al crear o aceptar un alta: hay que volver a leer las tablas.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const analysis = useMemo(() => (brandId && description ? decomposeDescription(brandId, description) : null), [brandId, description, altas])
  return { analysis, parts: analysis?.supported ? applyChoices(analysis.parts, choices) : [] }
}

/** Resumen corto de una variante para la lista: si todo existe o qué falta. */
export function VariantStatus({ brandId, description }) {
  const { analysis, parts } = usePartsOf(brandId, description, {})
  if (!analysis?.supported || parts.length === 0) return null
  const { news, ambiguous, missing } = summarizeParts(parts)
  if (news) return <Badge tone="error">{news === 1 ? '1 dato nuevo' : `${news} datos nuevos`}</Badge>
  if (ambiguous || missing) return <Badge tone="warn">Revisar</Badge>
  return <Badge tone="ok">Todo existe</Badge>
}

/**
 * Descripción contra la composición del SKU: cada parte (tipología, calota, gráfica, color)
 * muestra su código y si existe. Lo que no existe se da de alta desde acá, sin perder la revisión.
 */
export function DescriptionParts({ draft, onChange }) {
  const brandId = draft.fields.marca.value
  const description = draft.fields.descripcion.value
  const { analysis, parts } = usePartsOf(brandId, description, draft.choices)
  const [creating, setCreating] = useState(null)

  if (!analysis) return null
  if (!analysis.supported) return null
  if (parts.length === 0) return analysis.reason ? <p className="muted small">{analysis.reason}</p> : null

  const choose = (id, code) => onChange({ ...draft, choices: { ...draft.choices, [id]: code || undefined } })

  return (
    <div className="parts">
      <h4 className="parts__title">Composición de «{description}»</h4>
      <div className="table-wrap">
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Parte</th>
              <th>En la descripción</th>
              <th>Código</th>
              <th>Estado</th>
              <th>
                <span className="sr-only">Acción</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {parts.map((part) => {
              const badge = STATUS_BADGE[part.status]
              const pendingAlta = part.alta && isPendingAlta(part.alta)
              return (
                <tr key={part.id}>
                  <td className="strong">{part.label}</td>
                  <td className="mono">{part.detected || '—'}</td>
                  <td>
                    {part.status === COMPONENT_STATUS.AMBIGUOUS ? (
                      <select
                        aria-label={`Elegir ${part.label.toLowerCase()}`}
                        className="input input--sm select"
                        value=""
                        onChange={(e) => choose(part.id, e.target.value)}
                      >
                        <option value="">Elegí…</option>
                        {part.options.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.code} · {option.label}
                          </option>
                        ))}
                      </select>
                    ) : part.code ? (
                      <span>
                        <span className="mono strong">{part.code}</span> <span className="muted">{part.name}</span>
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                    {part.reason && <span className="parts__reason">{part.reason}</span>}
                  </td>
                  <td>
                    <Badge tone={pendingAlta ? 'warn' : badge.tone}>{pendingAlta ? 'Nuevo · sin aceptar' : badge.label}</Badge>
                  </td>
                  <td>
                    {part.status === COMPONENT_STATUS.NEW && part.create && (
                      <Button size="sm" variant="primary" onClick={() => setCreating(part)}>
                        Crear
                      </Button>
                    )}
                    {part.options.length > 0 && part.status === COMPONENT_STATUS.FOUND && draft.choices?.[part.id] && (
                      <button type="button" className="link-button" onClick={() => choose(part.id, '')}>
                        Cambiar
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {creating && <AltaDialog lockTarget initial={{ targetId: creating.create.targetId, values: creating.create.values }} onClose={() => setCreating(null)} />}
    </div>
  )
}
