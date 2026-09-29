// ─────────────────────────────────────────────────────────────
// Datos REALES de LS2 extraídos de los Excel de Andrés
// (CODIFICACION 2023 y CODIFICACION GENERICOS), usados como mock.
// No hay conexión a Tango, SQL ni APIs: esto es una foto de esos archivos.
// ─────────────────────────────────────────────────────────────
import data from './datosRealesLS2.json'

/** Talles de la tabla oficial, en orden: 2S, XS, S, M, L, XL, 2X, 3X, 4X, 5X, TU. */
export const OFFICIAL_SIZES = data.talles.map((row) => row.talle)

/** Tabla completa de talles: talle, sufijo y descripción (ej. 2X ↔ "XX"). */
export const SIZE_TABLE = data.talles

export const COLORS = data.colores

/** Artículos de LS2 ya creados (SKU, EAN, código del proveedor). */
export const EXISTING_ARTICLES = data.articulosLS2Existentes

export const EXISTING_SKUS = new Set(EXISTING_ARTICLES.map((article) => article.sku))

/** EAN → SKU del artículo que ya lo tiene asignado. */
export const EXISTING_EANS = new Map(
  EXISTING_ARTICLES.filter((article) => article.ean).map((article) => [article.ean, article.sku]),
)

/** Genéricos de LS2 con una clave única (el código solo se repite en algunos casos). */
export const GENERICOS = data.genericosLS2.map((generico) => ({
  ...generico,
  key: `${generico.codigo}|${generico.modelo}`,
}))

export function genericosForFamily(familia) {
  return GENERICOS.filter((generico) => generico.familia === familia)
}

export function findGenerico(key) {
  return GENERICOS.find((generico) => generico.key === key) ?? null
}

/**
 * Códigos genéricos asociados a más de un modelo (inconsistencia de los datos
 * reales, a revisar con Andrés). Código → lista de modelos.
 */
export const GENERICOS_REPETIDOS = (() => {
  const modelsByCode = new Map()
  GENERICOS.forEach(({ codigo, modelo }) => {
    const models = modelsByCode.get(codigo) ?? new Set()
    models.add(modelo)
    modelsByCode.set(codigo, models)
  })
  return new Map(
    [...modelsByCode].filter(([, models]) => models.size > 1).map(([codigo, models]) => [codigo, [...models]]),
  )
})()

/** Artículos existentes cuyo código de proveedor empieza con el prefijo indicado. */
export function articlesBySupplierPrefix(prefix) {
  return EXISTING_ARTICLES.filter((article) => article.codigoProveedor?.startsWith(prefix))
}
