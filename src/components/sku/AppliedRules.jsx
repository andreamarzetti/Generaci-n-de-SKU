import { RULE_STATUS } from '../../rules/constants'
import { GENERAL_RULES } from '../../rules/families'
import { Badge } from '../ui/Badge'
import { InfoPopup } from '../ui/InfoPopup'

const STATUS_BADGE = {
  [RULE_STATUS.CONFIRMED]: { tone: 'ok', label: 'Confirmada' },
  [RULE_STATUS.PENDING]: { tone: 'warn', label: 'A validar' },
  [RULE_STATUS.UNDEFINED]: { tone: 'neutral', label: 'Pendiente de definición' },
}

/**
 * Ícono (i) con las reglas del motor activo (LS2 o el de la marca) y las generales.
 * El título cuenta cuántas reglas hay y cuántas están a validar.
 */
export function AppliedRulesInfo({ family, label = family?.label, rules = family?.rules ?? [], generalRules = GENERAL_RULES }) {
  const all = [...rules, ...generalRules]
  const pending = all.filter((rule) => rule.status === RULE_STATUS.PENDING).length

  return (
    <InfoPopup label="Reglas aplicadas" title={`Reglas aplicadas · ${all.length} · ${pending} a validar`} wide>
      {label && <p className="muted small">{label}</p>}
      <RuleList rules={rules} />
      <h3 className="rules__subtitle">Generales</h3>
      <RuleList rules={generalRules} />
    </InfoPopup>
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
