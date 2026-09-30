import { PASTE_EXAMPLES } from '../../parsing/examples'
import { Button } from '../ui/Button'
import { InterpretationSummary } from './InterpretationSummary'

/**
 * "Pegar solicitud": el mail y/o las filas del Excel en un solo lugar.
 * Controlado desde la página, para conservar el estado al cambiar de marca.
 */
export function PasteRequestCard({ state, actions }) {
  const { open, text, draft, message, loadError, pendingConfirm, notice } = state

  return (
    <section className="card paste">
      <header className="card__header">
        <h2 className="card__title">
          <button
            type="button"
            className="collapse-toggle"
            aria-expanded={open}
            aria-controls="pegar-solicitud"
            onClick={actions.toggle}
          >
            <span className="collapse-toggle__icon" aria-hidden="true">
              {open ? '−' : '+'}
            </span>
            Pegar solicitud
          </button>
        </h2>
        <span className="muted small">Mail o filas del Excel · se interpreta sin enviar nada</span>
      </header>

      {open && (
        <div id="pegar-solicitud" className="paste__body">
          <label className="sr-only" htmlFor="pegar-solicitud-texto">
            Texto de la solicitud
          </label>
          <textarea
            id="pegar-solicitud-texto"
            className="input textarea paste__text"
            rows={7}
            value={text}
            placeholder="Pegá acá el mail o las filas del Excel"
            onChange={(e) => actions.setText(e.target.value)}
          />
          <div className="paste__actions">
            <Button variant="dark" onClick={actions.interpret} disabled={!text.trim()}>
              Interpretar
            </Button>
            {PASTE_EXAMPLES.map((example) => (
              <Button key={example.id} size="sm" onClick={() => actions.pasteExample(example.text)}>
                {example.label}
              </Button>
            ))}
            {(text || draft) && (
              <Button size="sm" variant="ghost" onClick={actions.clear}>
                Limpiar
              </Button>
            )}
          </div>

          {message && (
            <p className="paste__message" role="alert">
              {message}
            </p>
          )}

          {draft && (
            <>
              <h3 className="rules__subtitle">Lo que se interpretó · revisalo antes de cargar</h3>
              <InterpretationSummary draft={draft} onChange={actions.setDraft} onLoad={actions.load} loadError={loadError} />
            </>
          )}

          {pendingConfirm && (
            <div className="paste__confirm" role="alertdialog" aria-labelledby="pegar-confirmar-texto">
              <p id="pegar-confirmar-texto">
                Ya hay datos cargados en {pendingConfirm}. ¿Reemplazarlos por lo interpretado?
              </p>
              <div className="paste__actions">
                <Button variant="dark" size="sm" onClick={actions.confirmReplace}>
                  Reemplazar
                </Button>
                <Button size="sm" onClick={actions.cancelReplace}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {notice && (
            <p className="paste__notice" role="status">
              {notice}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
