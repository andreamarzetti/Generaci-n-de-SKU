// ─────────────────────────────────────────────────────────────
// Datos REALES de todas las marcas, extraídos de CODIFICACION 2023
// (hojas de referencia y de productos) y CODIFICACION GENERICOS, usados como mock.
// No hay conexión a Tango, SQL ni APIs: esto es una foto de esos archivos.
// ─────────────────────────────────────────────────────────────
import data from './datosRealesTodasLasMarcas.json'

// ── Todas las marcas ──────────────────────────────────────

/** Los 3.885 artículos existentes de todas las marcas (incluye los .MUE de COD SHOWROOM). */
export const ALL_ARTICLES = data.articulosExistentes
export const ALL_EXISTING_SKUS = new Set(ALL_ARTICLES.map((article) => article.sku))
export const ALL_EXISTING_EANS = new Map(
  ALL_ARTICLES.filter((article) => article.ean).map((article) => [article.ean, article.sku]),
)

export const BRANDS_DATA = data.marcas
export const ALL_GENERICOS = data.genericos.map((generico) => ({
  ...generico,
  key: `${generico.marca}|${generico.codigo}|${generico.modelo}`,
}))

/** Catálogos de cada estructura. */
export const REGLA_CASCOS = data.reglaCascos
/**
 * En la hoja REFERENCIA PRODUCTO, debajo de la lista de colores (columnas V–X) hay otras tablas en las mismas
 * columnas: «INDUMENTARIA / 6» (MUSCULOSA, JERSEY, CALZA CORTA…). Son tipos de indumentaria, no colores: el JSON las
 * trae pegadas a la lista de colores, así que se cortan en la primera (MUSCULOSA) para que no figuren como colores
 * ni como códigos repetidos (ej. 25 = VERDE FLUO y 25 = JERSEY son categorías distintas).
 */
const primerTipoDeIndumentaria = data.reglaProducto.colores.findIndex((item) => item.descripcion === 'MUSCULOSA')
export const REGLA_PRODUCTO = {
  ...data.reglaProducto,
  colores: primerTipoDeIndumentaria < 0 ? data.reglaProducto.colores : data.reglaProducto.colores.slice(0, primerTipoDeIndumentaria),
}
export const REGLA_PRODUCTO_GUD = data.reglaProductoGUD
export const REGLA_CASCOS_GUD = data.reglaCascosGUD
export const REGLA_MUESTRAS = data.reglaMuestras

/**
 * Tabla de talles de cascos (hoja REFERENCIA CASCOS): 2S, XS, S, M, L, XL, 2X, 3X, 4X, 5X, TU.
 * En el JSON figura como "tallesLS2"; la usan LS2 y los motores de cascos.
 */
export const TALLES_CASCOS = data.tallesLS2

// ── LS2 (motor propio, sin cambios) ───────────────────────

/** Talles de la tabla oficial, en orden: 2S, XS, S, M, L, XL, 2X, 3X, 4X, 5X, TU. */
export const OFFICIAL_SIZES = TALLES_CASCOS.map((row) => row.talle)

/** Tabla completa de talles: talle, sufijo y descripción (ej. 2X ↔ "XX"). */
export const SIZE_TABLE = TALLES_CASCOS

export const COLORS = data.coloresLS2

/** Artículos de LS2 ya creados (hoja LS2). El campo "familia" del JSON es la tipología. */
export const EXISTING_ARTICLES = ALL_ARTICLES.filter((article) => article.hoja === 'LS2').map((article) => ({
  sku: article.sku,
  ean: article.ean ?? null,
  codigoProveedor: article.codigoProveedor,
  tipologia: article.familia,
  descripcion: article.descripcion,
}))

export const EXISTING_SKUS = new Set(EXISTING_ARTICLES.map((article) => article.sku))

/** EAN → SKU del artículo que ya lo tiene asignado. */
export const EXISTING_EANS = new Map(
  EXISTING_ARTICLES.filter((article) => article.ean).map((article) => [article.ean, article.sku]),
)

/** Genéricos de LS2 con una clave única (el código solo se repite en algunos casos). */
export const GENERICOS = data.genericos
  .filter((generico) => generico.marca === 'LS2')
  .map(({ marca, ...generico }) => ({ ...generico, key: `${generico.codigo}|${generico.modelo}` }))

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
  ALL_GENERICOS.forEach(({ codigo, modelo }) => {
    const models = modelsByCode.get(codigo) ?? new Set()
    models.add(modelo)
    modelsByCode.set(codigo, models)
  })
  return new Map(
    [...modelsByCode].filter(([, models]) => models.size > 1).map(([codigo, models]) => [codigo, [...models]]),
  )
})()

/** Artículos existentes de LS2 cuyo código de proveedor empieza con el prefijo indicado. */
export function articlesBySupplierPrefix(prefix) {
  return EXISTING_ARTICLES.filter((article) => article.codigoProveedor?.startsWith(prefix))
}
