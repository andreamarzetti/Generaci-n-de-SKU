import { GENERICOS_REPETIDOS } from '../../data/realData'
import { auditLegacySizes, auditLongSkus, auditStructureAnomalies } from '../../rules/audit'
import { COLOR_ALIASES } from '../../rules/descriptions'
import { Card } from '../ui/Card'

const LONG_SKUS = auditLongSkus()
const ANOMALIES = auditStructureAnomalies()
const LEGACY_SIZES = auditLegacySizes()

// Quién hizo el cambio. Fijo por ahora, hasta tener el usuario logueado.
const CHANGED_BY = 'NOMBRE'

/** Auditoría informativa de los datos reales. No modifica nada. */
export function AuditCard() {
  return (
    <Card title="Auditoría de códigos existentes" aside={<span className="muted small">Solo informativo</span>}>
      <h3 className="rules__subtitle">SKUs de LS2 de más de 15 caracteres ({LONG_SKUS.length})</h3>
      <p className="muted small audit__intro">Corrección sugerida según la tabla oficial de talles:</p>
      <div className="table-wrap">
        <table className="table table--compact table--centered">
          <thead>
            <tr>
              <th>SKU actual</th>
              <th className="num">Largo</th>
              <th>Sugerido</th>
              <th className="num">Largo</th>
              <th>Cambio hecho por</th>
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
                <td>{CHANGED_BY}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="rules__subtitle">SKUs que no cumplen su estructura ({ANOMALIES.length})</h3>
      <div className="table-wrap">
        <table className="table table--compact">
          <thead>
            <tr>
              <th>SKU actual</th>
              <th>Hoja</th>
              <th>Problema</th>
              <th>Sugerido</th>
            </tr>
          </thead>
          <tbody>
            {ANOMALIES.map((item) => (
              <tr key={item.sku}>
                <td className="mono">{item.sku}</td>
                <td className="muted">{item.hoja}</td>
                <td className="text-error">{item.reason}</td>
                <td className="mono strong">
                  {item.suggested ?? <span className="muted">Sin corrección automática</span>}
                  {item.suggestedExists && <span className="small text-error"> (ya existe)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="rules__subtitle">Cascos con talle viejo ".XX" ({LEGACY_SIZES.length})</h3>
      <p className="muted small audit__intro">".XX" equivale a 2X en la tabla de cascos. Se acepta al leer, pero no se ofrece al generar.</p>
      <div className="table-wrap">
        <table className="table table--compact">
          <thead>
            <tr>
              <th>SKU actual</th>
              <th>Sugerido</th>
            </tr>
          </thead>
          <tbody>
            {LEGACY_SIZES.map((item) => (
              <tr key={item.sku}>
                <td className="mono">{item.sku}</td>
                <td className="mono strong">
                  {item.suggested}
                  {item.suggestedExists && <span className="small text-error"> (ya existe)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="rules__subtitle">Para revisar con Andrés</h3>
      <ul className="audit__findings">
        <li>
          Errores de tipeo en la tabla de colores de LS2:{' '}
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
