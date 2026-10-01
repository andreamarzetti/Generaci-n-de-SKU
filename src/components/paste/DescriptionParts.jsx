import { useMemo, useState } from 'react'
import { applyChoices, choicesFor, COMPONENT_STATUS, decomposeDescription, summarizeParts } from '../../parsing/components'
import { isPendingAlta } from '../../reference/store'
import { useAltas } from '../../reference/useAltas'
import { AltaDialog } from '../reference/AltaDialog'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { LinkButton } from '../ui/LinkButton'

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
  const analysis = useMemo(
    () => (brandId && description ? decomposeDescription(brandId, description) : null),
    [brandId, description, altas],
  )
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

/** Cambia la elección de una parte (`code` vacío = deshacer) solo para esa descripción. */
const withChoice = (draft, description, partId, code) => ({
  ...draft,
  choices: { ...draft.choices, [description]: { ...choicesFor(draft, description), [partId]: code || undefined } },
})

/**
 * Descripción contra la composición del SKU: cada parte (tipología, calota, gráfica, color)
 * muestra su código y si existe. Con una variante se ve parte por parte; con varias, una fila por variante.
 * Lo que no existe se da de alta desde acá, sin perder la revisión.
 */
export function DescriptionParts({ draft, onChange }) {
  const brandId = draft.fields.marca.value
  const selected = draft.selected ?? []
  const [creating, setCreating] = useState(null)

  const dialog = creating && (
    <AltaDialog
      lockTarget
      initial={{ targetId: creating.create.targetId, values: creating.create.values }}
      onClose={() => setCreating(null)}
    />
  )

  if (selected.length > 1) {
    return (
      <div className="parts">
        <h4 className="parts__title">Composición de las {selected.length} variantes</h4>
        <div className="table-wrap">
          <table className="table table--compact parts__matrix">
            <thead>
              <tr>
                <th>Variante</th>
                <th>Tipología</th>
                <th>Calota</th>
                <th>Gráfica</th>
                <th>Color</th>
              </tr>
            </thead>
            <tbody>
              {selected.map((description) => (
                <VariantRow
                  key={description}
                  brandId={brandId}
                  description={description}
                  choices={choicesFor(draft, description)}
                  onChoose={(partId, code) => onChange(withChoice(draft, description, partId, code))}
                  onCreate={setCreating}
                />
              ))}
            </tbody>
          </table>
        </div>
        {dialog}
      </div>
    )
  }

  return <SingleParts draft={draft} onChange={onChange} brandId={brandId} dialog={dialog} onCreate={setCreating} />
}

function SingleParts({ draft, onChange, brandId, dialog, onCreate }) {
  const description = draft.fields.descripcion.value
  const choices = choicesFor(draft, description)
  const { analysis, parts } = usePartsOf(brandId, description, choices)

  if (!analysis || !analysis.supported) return null
  if (parts.length === 0) return analysis.reason ? <p className="muted small">{analysis.reason}</p> : null

  const choose = (id, code) => onChange(withChoice(draft, description, id, code))

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
                      <PartSelect part={part} onChoose={choose} />
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
                      <Button size="sm" variant="primary" icon="plus" onClick={() => onCreate(part)}>
                        Crear
                      </Button>
                    )}
                    {part.options.length > 0 && part.status === COMPONENT_STATUS.FOUND && choices[part.id] && (
                      <LinkButton icon="edit" onClick={() => choose(part.id, '')}>
                        Cambiar
                      </LinkButton>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {dialog}
    </div>
  )
}

function PartSelect({ part, onChoose, description }) {
  return (
    <select
      aria-label={`Elegir ${part.label.toLowerCase()}${description ? ` de ${description}` : ''}`}
      className="input input--sm select"
      value=""
      onChange={(e) => onChoose(part.id, e.target.value)}
    >
      <option value="">Elegí…</option>
      {part.options.map((option) => (
        <option key={option.code} value={option.code}>
          {option.code} · {option.label}
        </option>
      ))}
    </select>
  )
}

/** Una variante en la matriz: sus cuatro partes en una fila. */
function VariantRow({ brandId, description, choices, onChoose, onCreate }) {
  const { analysis, parts } = usePartsOf(brandId, description, choices)

  if (!analysis?.supported || parts.length === 0) {
    return (
      <tr>
        <td className="mono small">{description}</td>
        <td colSpan={4} className="muted small">
          {analysis?.reason ?? 'No se puede descomponer esta descripción.'}
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td className="mono small">{description}</td>
      {parts.map((part) => {
        const pendingAlta = part.alta && isPendingAlta(part.alta)
        return (
          <td key={part.id}>
            {part.status === COMPONENT_STATUS.AMBIGUOUS ? (
              <PartSelect part={part} description={description} onChoose={onChoose} />
            ) : part.status === COMPONENT_STATUS.NEW ? (
              <span className="parts__cell">
                <Badge tone="error">No existe</Badge>
                {part.create && (
                  <Button size="sm" variant="primary" icon="plus" onClick={() => onCreate(part)} aria-label={`Crear ${part.label.toLowerCase()} de ${description}`}
                  >
                    Crear
                  </Button>
                )}
              </span>
            ) : part.code ? (
              <span title={part.reason || undefined}>
                <span className="mono strong">{part.code}</span> <span className="muted small">{part.name}</span>
                {part.status === COMPONENT_STATUS.DEDUCED && <Badge tone="warn">Deducido</Badge>}
                {pendingAlta && <Badge tone="warn">Sin aceptar</Badge>}
              </span>
            ) : (
              <Badge tone="neutral">Falta</Badge>
            )}
          </td>
        )
      })}
    </tr>
  )
}
