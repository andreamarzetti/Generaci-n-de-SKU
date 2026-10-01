const MAX_LISTED = 12

/** Lista los SKU si son pocos; si son muchos, solo la cantidad (el detalle está en la validación). */
function Skus({ skus }) {
  if (skus.length === 0 || skus.length > MAX_LISTED) return null
  return <span className="creation__skus mono">{skus.join(' · ')}</span>
}

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`

/**
 * Antes de confirmar: qué se va a crear (los casos sin problemas), qué se omite por ya existir,
 * y qué todavía lo impide. Aparece cuando ya se ejecutaron las validaciones.
 */
export function CreationPreview({ creation }) {
  if (!creation) return null
  const { create, omit, newGenerics, reusedGenerics, blocked } = creation

  return (
    <section className="creation" aria-label="Qué se va a crear">
      <h3 className="creation__title">Qué se va a crear</h3>

      <p className="creation__line creation__line--ok">
        <strong>✓ {plural(create.length, 'SKU nuevo', 'SKUs nuevos')}</strong>
        {newGenerics.length > 0 && <span>+ {plural(newGenerics.length, 'genérico nuevo', 'genéricos nuevos')}</span>}
        <Skus skus={[...newGenerics, ...create]} />
      </p>

      {reusedGenerics.length > 0 && (
        <p className="creation__line">
          <span>
            Se reutiliza {reusedGenerics.length === 1 ? 'el genérico' : 'los genéricos'} ya existente{reusedGenerics.length === 1 ? '' : 's'}:
          </span>
          <Skus skus={reusedGenerics} />
        </p>
      )}

      {omit.length > 0 && (
        <p className="creation__line creation__line--warn">
          <strong>{plural(omit.length, 'SKU ya existente', 'SKUs ya existentes')}: se omitirá su creación</strong>
          <Skus skus={omit} />
        </p>
      )}

      {blocked > 0 && (
        <p className="creation__line creation__line--error">
          <strong>{plural(blocked, 'SKU con error', 'SKUs con error')}</strong>
          <span>no se puede confirmar hasta resolverlos.</span>
        </p>
      )}
    </section>
  )
}
