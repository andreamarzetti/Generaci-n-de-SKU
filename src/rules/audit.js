import { EXISTING_ARTICLES, EXISTING_SKUS, SIZE_TABLE } from '../data/realData'
import { MAX_SKU_LENGTH } from './constants'
import { normalizeSize } from './sizes'

// "XX", "SS"… son la descripción de un talle en la tabla oficial (XX = 2X).
const SIZE_BY_DESCRIPTION = Object.fromEntries(SIZE_TABLE.map((row) => [row.descripcion, row.talle]))

/**
 * Auditoría informativa: SKUs reales de más de 15 caracteres y la corrección
 * sugerida (talle según la tabla oficial). No modifica nada.
 */
export function auditLongSkus(articles = EXISTING_ARTICLES, existingSkus = EXISTING_SKUS) {
  return articles
    .filter((article) => article.sku.length > MAX_SKU_LENGTH)
    .map((article) => {
      const [base, size] = article.sku.split('.')
      const official = normalizeSize(size).value ?? SIZE_BY_DESCRIPTION[size] ?? null
      const suggested = official ? `${base}.${official}` : null
      return {
        sku: article.sku,
        length: article.sku.length,
        descripcion: article.descripcion,
        suggested,
        suggestedLength: suggested?.length ?? null,
        suggestedExists: suggested ? existingSkus.has(suggested) : false,
      }
    })
}
