// SKU genérico: el mismo SKU sin el talle (LS2980600201.S → LS2980600201). Es el artículo "padre"
// de la curva de talles y se da de alta además de un SKU por talle.

/** Sufijo de talle: ".S", ".M", ".2X", ".40", ".XXL"… */
const SIZE_SUFFIX = /\.[0-9A-Z,]+$/

/**
 * SKU genérico de un SKU con talle. Devuelve null si no hay curva de talles:
 * sin talle (INTO80210202) o con talle único (.TU).
 */
export function genericSkuOf(sku) {
  const suffix = sku ? SIZE_SUFFIX.exec(sku)?.[0] : null
  if (!suffix || suffix === '.TU') return null
  return sku.slice(0, -suffix.length)
}

/**
 * Un genérico por cada variante: los SKU que comparten base dan un solo genérico.
 * `describe(row)` devuelve la descripción sin talle de la fila.
 * @returns {{ sku: string, descripcion: string }[]}
 */
export function genericSkus(rows, describe) {
  const found = new Map()
  rows.forEach((row) => {
    const sku = genericSkuOf(row.sku)
    if (sku && !found.has(sku)) found.set(sku, { sku, descripcion: describe(row) })
  })
  return [...found.values()]
}

/**
 * Si el genérico ya existe (artículos reales o confirmados en la sesión) se avisa: no es un error,
 * porque al sumar talles a una variante existente el genérico se reutiliza.
 */
export function checkGenericExists(sku, { existingSkus, sessionSkus }) {
  const generic = genericSkuOf(sku)
  if (!generic) return null
  if (existingSkus.has(generic) || sessionSkus.has(generic)) return { status: 'warn', message: `El SKU genérico ${generic} ya existe: se reutiliza` }
  return null
}
