import { ALL_ARTICLES, ALL_EXISTING_SKUS, EXISTING_ARTICLES, EXISTING_SKUS, SIZE_TABLE } from '../data/realData'
import { decomposeSku, ENGINES } from '../engines/engines'
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

// Hoja de productos → motor con el que se valida su estructura.
const PRODUCT_SHEETS = {
  'PROD. MAC': ENGINES.productoMAC,
  'PROD. NTO': ENGINES.productoNTO,
  'PROD. GUD': ENGINES.productoGUD,
  SERVICOM: ENGINES.producto921,
}

/** Si al SKU le falta el punto del talle y agregándolo respeta la estructura, devuelve la corrección. */
function withSizeDot(engine, sku) {
  for (const sizeLength of [2, 1]) {
    const candidate = `${sku.slice(0, -sizeLength)}.${sku.slice(-sizeLength)}`
    if (!sku.includes('.') && decomposeSku(engine, candidate)) return candidate
  }
  return null
}

/**
 * SKUs reales de producto que no respetan su estructura, con la corrección
 * sugerida cuando se puede inferir. Solo informativo.
 */
export function auditStructureAnomalies(articles = ALL_ARTICLES, existingSkus = ALL_EXISTING_SKUS) {
  return articles.flatMap((article) => {
    const engine = PRODUCT_SHEETS[article.hoja]
    if (!engine || decomposeSku(engine, article.sku)) return []
    const dotted = withSizeDot(engine, article.sku)
    const expectedBody = engine.segments.reduce((total, segment) => total + segment.length, 0)
    const body = article.sku.split('.')[0]

    let reason = 'No respeta la estructura (fila de prueba)'
    if (dotted) reason = 'Le falta el punto del talle'
    else if (article.sku.startsWith(engine.segments[0].fixed ?? '') || /^[INO]/.test(article.sku)) {
      if (body.length === expectedBody - 1) reason = 'Le falta un dígito'
    }
    return [
      {
        sku: article.sku,
        hoja: article.hoja,
        descripcion: article.descripcion,
        reason,
        suggested: dotted,
        suggestedExists: dotted ? existingSkus.has(dotted) : false,
      },
    ]
  })
}

/** SKUs de cascos con el talle viejo ".XX" (equivale a 2X en la tabla de cascos). */
export function auditLegacySizes(articles = ALL_ARTICLES, existingSkus = ALL_EXISTING_SKUS) {
  return articles
    .filter((article) => article.hoja === 'CASCOS MAC-URX' && article.sku.endsWith('.XX'))
    .map((article) => {
      const suggested = article.sku.replace(/\.XX$/, '.2X')
      return { sku: article.sku, descripcion: article.descripcion, suggested, suggestedExists: existingSkus.has(suggested) }
    })
}
