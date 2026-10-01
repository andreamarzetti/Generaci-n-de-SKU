import { CHECKS } from '../../rules/validateRows'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { CollapsibleGroups, groupByVariant } from '../ui/CollapsibleGroups'

const STATE_TEXT = {
  idle: 'Todavía no se ejecutaron las validaciones.',
  running: 'Consultando los datos reales (mock)…',
  stale: 'Los datos cambiaron desde la última validación. Volvé a validar.',
}

const COUNTED = ['warn', 'error']

/**
 * `rows` son las filas de la propuesta: con varias variantes, los errores y advertencias se agrupan por variante
 * (la primera expandida y las demás plegadas), igual que en la propuesta.
 */
export function ValidationPanel({ status, results, summary, checks = CHECKS, info, rows = [] }) {
  const conflicts = (results ?? []).flatMap((row) =>
    checks
      .filter((check) => COUNTED.includes(row.checks[check.id].status))
      .map((check) => ({
        id: `${row.key}-${check.id}`,
        key: row.key,
        sku: row.sku ?? row.key,
        check: check.label,
        ...row.checks[check.id],
      })),
  )

  const resultsByKey = Object.fromEntries((results ?? []).map((row) => [row.key, row]))
  const hasIssues = (row) => COUNTED.includes(resultsByKey[row.key]?.status)
  const variantGroups = results
    ? groupByVariant(rows, { resultsByKey, buildMeta: (items) => (items.some(hasIssues) ? null : <Badge tone="ok">Sin problemas</Badge>) })
    : null

  // Resultado por SKU: lo que tiene errores o advertencias, y lo que pasó sin problemas.
  const resultList = (items) => (
    <ul>
      {items.flatMap((result) => {
        const own = conflicts.filter((conflict) => conflict.key === result.key)
        if (own.length === 0) {
          return [
            <li key={result.key} className="conflict is-ok">
              <span className="mono strong">{result.sku ?? result.key}</span>
              <span className="conflict__check">Todos los controles</span>
              <span>Sin problemas</span>
            </li>,
          ]
        }
        return own.map((conflict) => (
          <li key={conflict.id} className={`conflict is-${conflict.status}`}>
            <span className="mono strong">{conflict.sku}</span>
            <span className="conflict__check">{conflict.check}</span>
            <span>{conflict.message}</span>
          </li>
        ))
      })}
    </ul>
  )

  return (
    <Card
      title="Validaciones"
      info={info}
      aside={
        results && (
          <div className="summary-chips">
            <Badge tone="ok">
              {summary.ok} {summary.ok === 1 ? 'listo' : 'listos'}
            </Badge>
            <Badge tone={summary.warn ? 'warn' : 'neutral'}>
              {summary.warn} {summary.warn === 1 ? 'advertencia' : 'advertencias'}
            </Badge>
            <Badge tone={summary.error ? 'error' : 'neutral'}>
              {summary.error} {summary.error === 1 ? 'bloqueante' : 'bloqueantes'}
            </Badge>
          </div>
        )
      }
    >
      {!results && <p className={`validation-state is-${status}`}>{STATE_TEXT[status]}</p>}

      <div className="checks">
        {checks.map((check) => {
          const state = aggregate(results, check.id)
          return (
            <div key={check.id} className={`check is-${state.status}`}>
              <div className="check__top">
                <span className="check__label">{check.label}</span>
                <span className="check__state">{state.text}</span>
              </div>
              <p className="check__desc">{check.description}</p>
              <p className="check__source">{check.source}</p>
            </div>
          )
        })}
      </div>

      {variantGroups ? (
        <div className="conflicts">
          <h3 className="conflicts__title">Resultado por SKU</h3>
          <CollapsibleGroups groups={variantGroups}>
            {(group) => resultList(group.rows.map((row) => resultsByKey[row.key]).filter(Boolean))}
          </CollapsibleGroups>
        </div>
      ) : (
        results?.length > 0 && (
          <div className="conflicts">
            <h3 className="conflicts__title">Resultado por SKU</h3>
            {resultList(results)}
          </div>
        )
      )}
    </Card>
  )
}

function aggregate(results, checkId) {
  if (!results) return { status: 'idle', text: '—' }
  const statuses = results.map((row) => row.checks[checkId].status)
  const count = (status) => statuses.filter((s) => s === status).length
  if (count('error')) return { status: 'error', text: `${count('error')} con error` }
  if (count('warn')) return { status: 'warn', text: `${count('warn')} a revisar` }
  if (count('pending') === statuses.length) return { status: 'pending', text: 'Pendiente de definición' }
  if (count('ok') === 0) return { status: 'na', text: 'No aplica' }
  return { status: 'ok', text: `${count('ok')} OK` }
}
