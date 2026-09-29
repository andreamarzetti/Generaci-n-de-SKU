import { RULE_STATUS } from '../../rules/constants'
import { GENERAL_RULES } from '../../rules/families'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'

const STATUS_BADGE = {
  [RULE_STATUS.CONFIRMED]: { tone: 'ok', label: 'Confirmada' },
  [RULE_STATUS.PENDING]: { tone: 'warn', label: 'A validar' },
  [RULE_STATUS.UNDEFINED]: { tone: 'neutral', label: 'Pendiente de definición' },
}

export function AppliedRules({ family }) {
  return (
    <Card title="Reglas aplicadas" aside={<span className="muted small">{family.label}</span>}>
      <RuleList rules={family.rules} />
      <h3 className="rules__subtitle">Generales</h3>
      <RuleList rules={GENERAL_RULES} />
    </Card>
  )
}

function RuleList({ rules }) {
  return (
    <ul className="rules">
      {rules.map((rule) => {
        const badge = STATUS_BADGE[rule.status]
        return (
          <li key={rule.text} className="rule">
            <div>
              <span>{rule.text}</span>
              <span className="rule__source">
                Fuente: {rule.source}
                {rule.note ? ` · ${rule.note}` : ''}
              </span>
            </div>
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </li>
        )
      })}
    </ul>
  )
}
