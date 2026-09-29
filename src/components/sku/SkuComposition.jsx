import { MAX_SKU_LENGTH } from '../../rules/constants'
import { Card } from '../ui/Card'

export function SkuComposition({ segments, proposal, onChooseFreeDigit, showFreeDigits }) {
  const lengths = proposal.rows.filter((row) => row.sku).map((row) => row.sku.length)
  const longest = lengths.length ? Math.max(...lengths) : 0
  const hasPending = segments.some((segment) => segment.pending)
  const groups = proposal.groups ?? []

  return (
    <Card
      title="Composición del SKU"
      aside={
        <span className={`length-meter ${longest > MAX_SKU_LENGTH ? 'is-error' : longest ? 'is-ok' : ''}`}>
          {longest || '—'} / máx. {MAX_SKU_LENGTH} caracteres
          {lengths.length > 1 && <small> (el más largo)</small>}
        </span>
      }
    >
      <div className="composition">
        {segments.map((segment) => (
          <div key={segment.id} className="composition__segment">
            <span className={`segment segment--${segment.variant} ${segment.value ? '' : 'is-empty'}`}>
              {segment.value || '·'.repeat(segment.size ?? 3)}
            </span>
            <span className="segment__label">
              {segment.label}
              {segment.pending && <sup title="A validar">*</sup>}
            </span>
          </div>
        ))}
      </div>

      {showFreeDigits && (
        <div className="free-digits">
          <p className="free-digits__title">
            Dos dígitos libres{groups.length > 1 ? ' por variante' : ''}{' '}
            <span className="muted">· disponibilidad contra los artículos reales de LS2 y la sesión (mock)</span>
          </p>
          {groups.length === 0 ? (
            <p className="muted small">Cargá el código de barras de los talles para buscar dígitos libres.</p>
          ) : (
            groups.map((group) => (
              <div key={group.key} className="free-digits__group">
                {groups.length > 1 && (
                  <p className="free-digits__variant">
                    <span className="mono strong">{group.prefix}</span> · {group.variant || 'sin descripción'}
                  </p>
                )}
                <div className="free-digits__list">
                  {group.options.map((option) => {
                    const selected = option.value === group.freeDigit
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={Boolean(option.usedIn)}
                        className={`digit-chip ${selected ? 'is-selected' : ''} ${option.usedIn ? 'is-used' : ''}`}
                        onClick={() => onChooseFreeDigit(group.key, option.value)}
                        title={option.usedIn ? `En uso en ${option.usedIn}` : 'Libre'}
                      >
                        {option.value} {option.usedIn ? `en uso · ${option.usedIn}` : selected ? 'libre · elegido' : 'libre'}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {proposal.issues.length > 0 && (
        <ul className="input-issues">
          {proposal.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}

      {hasPending && <p className="footnote">* A validar: rango de dígitos libres 01–09, observado en los datos reales.</p>}
    </Card>
  )
}
