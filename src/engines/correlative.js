const DIGITS = '0123456789'.split('')
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

/**
 * Secuencia de códigos de artículo de 2 caracteres (hoja de referencia de producto):
 * 01–99, luego AA–ZZ, 0A–9Z y A0–Z9.
 */
export const ARTICLE_SEQUENCE = [
  ...Array.from({ length: 99 }, (_, index) => String(index + 1).padStart(2, '0')),
  ...LETTERS.flatMap((first) => LETTERS.map((second) => first + second)),
  ...DIGITS.flatMap((first) => LETTERS.map((second) => first + second)),
  ...LETTERS.flatMap((first) => DIGITS.map((second) => first + second)),
]

/** Códigos de artículo ya usados con un prefijo (todo lo que va antes del artículo). */
export function usedArticleCodes(prefix, skus) {
  const codes = new Set()
  skus.forEach((sku) => {
    if (sku.startsWith(prefix)) codes.add(sku.slice(prefix.length, prefix.length + 2))
  })
  return codes
}

/**
 * Siguiente correlativo libre: el primero de la secuencia después del más alto ya usado.
 * No se reutilizan huecos intermedios (A validar). Devuelve null si la secuencia se agotó.
 */
export function nextArticleCode(used) {
  let highest = -1
  ARTICLE_SEQUENCE.forEach((code, index) => {
    if (used.has(code)) highest = index
  })
  return ARTICLE_SEQUENCE.slice(highest + 1).find((code) => !used.has(code)) ?? null
}
