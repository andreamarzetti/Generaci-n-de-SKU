import { BATCH_COLUMNS } from '../../rules/batch'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'

/** Área para pegar un bloque copiado de Excel (columnas separadas por tabulación). */
export function BatchInput({ id, family, text, preview, loaded, onTextChange, onApply, onDiscard }) {
  const withErrors = preview.rows.filter((row) => row.errors.length > 0).length
  const codeHint =
    family.scheme === 'cascos'
      ? 'En cascos se ignora el código proveedor.'
      : `El código proveedor es obligatorio para ${family.label}.`

  return (
    <div className="batch">
      <Field
        label="Bloque copiado de Excel"
        htmlFor={id}
        hint={`Columnas: ${BATCH_COLUMNS.join(' · ')}. ${codeHint} El encabezado se detecta solo.`}
        counter={<span className="field__counter">{preview.rows.length} filas</span>}
      >
        <textarea
          id={id}
          className="input input--mono textarea batch__text"
          rows={6}
          value={text}
          placeholder={'Pegá acá las filas copiadas de Excel\nFF806 FUSION TECK LIGHT GRAY RED GLOSS\t9806002025011\t6937449162997\tS'}
          onChange={(e) => onTextChange(e.target.value)}
        />
      </Field>

      {preview.rows.length > 0 && (
        <ul className="batch__preview" aria-label="Filas leídas">
          {preview.rows.map((row) => (
            <li key={row.key} className={row.errors.length ? 'is-error' : 'is-ok'}>
              <span className="batch__line">L{row.line}</span>
              <span className="mono">{row.size?.value ?? row.size?.raw ?? '—'}</span>
              <span className="mono batch__code">{row.codigo || row.barras || '—'}</span>
              <span className="batch__status">{row.errors.length ? row.errors.join(' · ') : 'Lista para cargar'}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="batch__actions">
        <Button size="sm" variant="dark" disabled={preview.rows.length === 0} onClick={onApply}>
          Usar {preview.rows.length} {preview.rows.length === 1 ? 'fila' : 'filas'}
        </Button>
        {loaded && (
          <Button size="sm" variant="ghost" onClick={onDiscard}>
            Descartar lote
          </Button>
        )}
        {withErrors > 0 && (
          <span className="small text-error">
            {withErrors} {withErrors === 1 ? 'fila con error' : 'filas con error'}: se cargan igual y quedan bloqueadas.
          </span>
        )}
      </div>
    </div>
  )
}
