import { Field } from '../ui/Field'

const optionText = (option) => `${option.code} · ${option.label}`

/** Selectores de cada segmento del motor, con los catálogos reales. */
export function EngineFields({ idPrefix, gen }) {
  const { engine, selections, actions } = gen
  return (
    <>
      {engine.segments.map((segment) => {
        if (segment.fixed) return null
        const id = `${idPrefix}-${segment.id}`
        if (segment.article) return <ArticleField key={segment.id} id={id} segment={segment} gen={gen} />

        const options = segment.getOptions(selections)
        const waitingFamily = segment.id === 'tipologia' && 'familia' in selections === false && options.length === 0
        return (
          <Field
            key={segment.id}
            label={`${segment.label} (${segment.length})`}
            htmlFor={id}
            hint={waitingFamily ? 'Elegí la familia primero.' : `${options.length} opciones`}
          >
            <select
              id={id}
              className="input select"
              value={selections[segment.id] ?? ''}
              disabled={options.length === 0}
              onChange={(e) => actions.updateSelection(segment.id, e.target.value)}
            >
              <option value="">Elegí…</option>
              {options.map((option) => (
                <option key={option.code} value={option.code}>
                  {optionText(option)}
                </option>
              ))}
            </select>
          </Field>
        )
      })}
      <SizesField idPrefix={idPrefix} gen={gen} />
    </>
  )
}

/** Artículo: primero de la tabla de la línea; si el modelo es nuevo, correlativo sugerido editable. */
function ArticleField({ id, segment, gen }) {
  const { articleMode, articleLine, articleValue, articlePrefix, suggestedArticle, articleInUse, selections, actions } = gen
  const line = segment.lines.find((item) => item.id === articleLine) ?? (segment.lines.length === 1 ? segment.lines[0] : null)

  return (
    <div className="field">
      <span className="field__label">Artículo (2)</span>
      <div className="tabs" role="tablist" aria-label="Origen del artículo">
        {[
          { id: 'tabla', label: 'De la tabla' },
          { id: 'nuevo', label: 'Modelo nuevo' },
        ].map((mode) => (
          <button
            key={mode.id}
            type="button"
            role="tab"
            aria-selected={articleMode === mode.id}
            className={`tabs__tab ${articleMode === mode.id ? 'is-active' : ''}`}
            onClick={() => actions.chooseArticleMode(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {articleMode === 'tabla' ? (
        <>
          {segment.lines.length > 1 && (
            <select
              id={`${id}-linea`}
              aria-label="Línea"
              className="input select"
              value={articleLine}
              onChange={(e) => actions.chooseArticleLine(e.target.value)}
            >
              <option value="">Elegí la línea…</option>
              {segment.lines.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          )}
          <select
            id={id}
            aria-label="Artículo"
            className="input select"
            value={selections.articulo ?? ''}
            disabled={!line}
            onChange={(e) => actions.updateSelection('articulo', e.target.value)}
          >
            <option value="">{line ? 'Elegí el artículo…' : 'Elegí la línea primero'}</option>
            {line?.items.map((option) => (
              <option key={option.code} value={option.code}>
                {optionText(option)}
              </option>
            ))}
          </select>
        </>
      ) : (
        <>
          <input
            id={id}
            className="input input--mono"
            value={articleValue}
            maxLength={2}
            placeholder="—"
            onChange={(e) => actions.setArticleCode(e.target.value)}
          />
          <p className={articleInUse ? 'field__error' : 'field__hint'}>
            {!articlePrefix
              ? 'Completá los segmentos anteriores para sugerir el correlativo.'
              : articleInUse
                ? `El artículo ${articleValue} ya está usado con el prefijo ${articlePrefix}.`
                : `Sugerido: ${suggestedArticle ?? 'secuencia agotada'} (siguiente libre para ${articlePrefix}). Editable.`}
          </p>
        </>
      )}
    </div>
  )
}

function SizesField({ idPrefix, gen }) {
  const { engine, sizes, actions } = gen
  const groups = [...new Set(engine.sizes.map((size) => size.group))]
  const chip = (code, label) => (
    <button
      key={code || 'sin-talle'}
      type="button"
      aria-pressed={sizes.includes(code)}
      className={`size-chip ${sizes.includes(code) ? 'is-active' : ''}`}
      onClick={() => actions.toggleSize(code)}
    >
      {label}
    </button>
  )

  return (
    <div className="field" id={`${idPrefix}-talles`}>
      <span className="field__label">Talles</span>
      {groups.map((group) => (
        <div key={group} className="size-group">
          {groups.length > 1 && <span className="size-group__label">{group}</span>}
          <div className="size-picker" role="group" aria-label={`Talles ${group}`}>
            {engine.sizes.filter((size) => size.group === group).map((size) => chip(size.code, size.label))}
          </div>
        </div>
      ))}
      {engine.allowNoSize && (
        <div className="size-picker" role="group" aria-label="Sin talle">
          {chip('', 'Sin talle')}
        </div>
      )}
      <p className="field__hint">Un SKU por talle elegido.</p>
    </div>
  )
}
