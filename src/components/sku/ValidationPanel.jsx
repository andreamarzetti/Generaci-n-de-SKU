import { CHECKS } from '../../rules/validateRows'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'

const STATE_TEXT = {
  idle: 'Todavía no se ejecutaron las validaciones.',
  running: 'Consultando los datos reales (mock)…',
  stale: 'Los datos cambiaron desde la última validación. Volvé a validar.',
}

const COUNTED = ['warn', 'error']

export function ValidationPanel({ status, results, summary, checks = CHECKS, info }) {
  const conflicts = (results ?? []).flatMap((row) =>
    checks.filter((check) => COUNTED.includes(row.checks[check.id].status)).map((check) => ({
      id: `${row.key}-${check.id}`,
      sku: row.sku ?? row.key,
      check: check.label,
      ...row.checks[check.id],
    })),
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

      {conflicts.length > 0 && (
        <div className="conflicts">
          <h3 className="conflicts__title">Errores y advertencias</h3>
          <ul>
            {conflicts.map((conflict) => (
              <li key={conflict.id} className={`conflict is-${conflict.status}`}>
                <span className="mono strong">{conflict.sku}</span>
                <span className="conflict__check">{conflict.check}</span>
                <span>{conflict.message}</span>
              </li>
            ))}
          </ul>
        </div>
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
