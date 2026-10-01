// Carga de varias variantes juntas: una curva de talles para todas y, si hace falta, talles propios
// en alguna. Una variante sin talles propios (`sizes: null`) usa la curva.

/** Talles que tiene una variante: los propios o, si no tiene, los de la curva. */
export const effectiveSizes = (variant, curve) => variant.sizes ?? curve

export const hasOwnSizes = (variant) => variant.sizes != null

/** Agrega o quita un talle y deja la lista en el orden de `order` (la tabla de talles). */
export function toggleInOrder(list, code, order = []) {
  const next = list.includes(code) ? list.filter((item) => item !== code) : [...list, code]
  return order.length ? [...next].sort((a, b) => order.indexOf(a) - order.indexOf(b)) : next
}

/** ¿Son los mismos talles? (sin importar el orden) */
export const sameSizes = (a, b) => a.length === b.length && a.every((code) => b.includes(code))

/** Clave de una fila: variante + talle (el código de barras y el EAN se cargan por fila). */
export const planRowKey = (variantKey, size) => `${variantKey}|${size || 'SIN_TALLE'}`

/**
 * Filas de la carga masiva de LS2 (cascos): una por variante y talle. El código de barras y el EAN
 * de cada una se completan en la tabla de SKU.
 */
export function ls2RowsFromPlan({ variants, curve }, normalizeSize) {
  return variants.flatMap((variant) =>
    effectiveSizes(variant, curve).map((size) => ({
      key: planRowKey(variant.key, size),
      line: null,
      descripcion: variant.descripcion,
      barras: '',
      ean: '',
      size: normalizeSize(size),
      codigo: '',
      base: null,
      errors: [],
    })),
  )
}

/** Variantes numeradas V1, V2… a partir de sus descripciones. */
export const variantsFromDescriptions = (descriptions) => descriptions.map((descripcion, index) => ({ key: `V${index + 1}`, descripcion, sizes: null }))
