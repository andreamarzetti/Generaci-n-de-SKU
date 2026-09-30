import { useState } from 'react'
import { RULE_STATUS } from '../../rules/constants'
import { GENERAL_RULES } from '../../rules/families'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

const STATUS_BADGE = {
  [RULE_STATUS.CONFIRMED]: { tone: 'ok', label: 'Confirmada' },
  [RULE_STATUS.PENDING]: { tone: 'warn', label: 'A validar' },
  [RULE_STATUS.UNDEFINED]: { tone: 'neutral', label: 'Pendiente de definición' },
}

/**
 * Reglas del motor activo (LS2 o el de la marca) y generales. Colapsable y cerrada por
 * defecto; el encabezado cuenta cuántas reglas hay y cuántas están a validar.
 * Puede ser controlada (open + onToggle) o manejar su propio estado.
 */
export function AppliedRules({
  family,
  label = family?.label,
  rules = family?.rules ?? [],
  generalRules = GENERAL_RULES,
  open: controlledOpen,
  onToggle,
  defaultOpen = false,
}) {
  const [ownOpen, setOwnOpen] = useState(defaultOpen)
  const open = controlledOpen ?? ownOpen
  const toggle = onToggle ?? (() => setOwnOpen((prev) => !prev))

  const all = [...rules, ...generalRules]
  const pending = all.filter((rule) => rule.status === RULE_STATUS.PENDING).length
  const title = `Reglas aplicadas · ${all.length} · ${pending} a validar`

  return (
    <Card
      title={title}
      className={open ? '' : 'card--collapsed'}
      aside={
        <div className="card__actions">
          <span className="muted small">{label}</span>
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={open}
            onClick={toggle}
            title={open ? 'Ocultar reglas aplicadas' : 'Mostrar reglas aplicadas'}
          >
            {open ? 'Cerrar ▴' : 'Abrir ▾'}
          </Button>
        </div>
      }
    >
      {open && (
        <>
          <RuleList rules={rules} />
          <h3 className="rules__subtitle">Generales</h3>
          <RuleList rules={generalRules} />
        </>
      )}
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
