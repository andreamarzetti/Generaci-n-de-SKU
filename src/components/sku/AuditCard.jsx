import { GENERICOS_REPETIDOS } from '../../data/realData'
import { auditLongSkus } from '../../rules/audit'
import { COLOR_ALIASES } from '../../rules/descriptions'
import { Card } from '../ui/Card'

const LONG_SKUS = auditLongSkus()

/** Auditoría informativa de los datos reales. No modifica nada. */
export function AuditCard() {
  return (
    <Card title="Auditoría de códigos existentes" aside={<span className="muted small">Solo informativo</span>}>
      <p className="muted small audit__intro">
        {LONG_SKUS.length} SKUs reales superan los 15 caracteres. Corrección sugerida según la tabla oficial de talles:
      </p>
      <div className="table-wrap">
        <table className="table table--compact">
          <thead>
            <tr>
              <th>SKU actual</th>
              <th className="num">Largo</th>
              <th>Sugerido</th>
              <th className="num">Largo</th>
            </tr>
          </thead>
          <tbody>
            {LONG_SKUS.map((item) => (
              <tr key={item.sku}>
                <td className="mono">{item.sku}</td>
                <td className="num mono text-error">{item.length}</td>
                <td className="mono strong">
                  {item.suggested ?? '—'}
                  {item.suggestedExists && <span className="small text-error"> (ya existe)</span>}
                </td>
                <td className="num mono">{item.suggestedLength ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="rules__subtitle">Para revisar con Andrés</h3>
      <ul className="audit__findings">
        <li>
          Errores de tipeo en la tabla de colores:{' '}
          {COLOR_ALIASES.filter((alias) => alias.note.includes('dice')).map((alias) => alias.note.replace('la tabla dice ', '')).join(', ')}.
        </li>
        <li>
          Códigos genéricos asociados a más de un modelo:{' '}
          {[...GENERICOS_REPETIDOS].map(([codigo, models]) => `${codigo} (${models.join(' y ')})`).join(' · ')}.
        </li>
      </ul>
    </Card>
  )
}
