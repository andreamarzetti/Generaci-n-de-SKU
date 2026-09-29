import { OFFICIAL_SIZES } from '../data/realData'

export { OFFICIAL_SIZES }

/** Variantes que llegan del proveedor y su talle oficial. */
export const SIZE_ALIASES = {
  XXL: '2X',
  '2XL': '2X',
  XXX: '3X',
  '3XL': '3X',
  '4XL': '4X',
  '5XL': '5X',
}

/**
 * Normaliza un talle recibido a la tabla oficial.
 * "XXL" → { value: "2X", normalized: true } · "M" → { value: "M", normalized: false }
 */
export function normalizeSize(raw) {
  const clean = String(raw ?? '').trim().toUpperCase()
  if (OFFICIAL_SIZES.includes(clean)) return { raw: clean, value: clean, normalized: false, recognized: true }
  if (SIZE_ALIASES[clean]) return { raw: clean, value: SIZE_ALIASES[clean], normalized: true, recognized: true }
  return { raw: clean, value: null, normalized: false, recognized: false }
}

export function sortBySize(sizes) {
  const index = (size) => {
    const position = OFFICIAL_SIZES.indexOf(normalizeSize(size).value)
    return position === -1 ? OFFICIAL_SIZES.length : position
  }
  return [...sizes].sort((a, b) => index(a) - index(b))
}

// Letras finales que pueden ser talle (oficiales y variantes).
const SIZE_TOKENS = [...new Set([...OFFICIAL_SIZES, ...Object.keys(SIZE_ALIASES)])]
  .filter((token) => token !== 'TU')
  // Ante igual respaldo del grupo, se prefieren las variantes de solo letras (S antes que 2S).
  .sort((a, b) => Number(/\d/.test(a)) - Number(/\d/.test(b)) || b.length - a.length)

const onlyDigits = (value) => value.replace(/\D/g, '')

function sizeCandidates(code) {
  return SIZE_TOKENS.filter((token) => code.length > token.length && code.endsWith(token)).map((token) => ({
    base: onlyDigits(code.slice(0, -token.length)),
    size: normalizeSize(token),
  }))
}

/**
 * Separa código base y talle en una lista de códigos del proveedor del mismo modelo.
 * Se quitan las letras intermedias: "64240W0112S" → base "642400112", talle S.
 *
 * Un código como "64240W01123XL" es ambiguo (XL con base …1123, o 3XL con base …112).
 * Se resuelve eligiendo la base que comparte la mayoría de los códigos pegados:
 * con este criterio se reproducen 265 de los 267 SKUs reales con talle.
 */
export function splitSupplierCodes(codes) {
  const candidates = codes.map((code) => sizeCandidates(code.trim().toUpperCase()))
  const support = {}
  candidates.forEach((list) => {
    new Set(list.map((candidate) => candidate.base)).forEach((base) => {
      support[base] = (support[base] ?? 0) + 1
    })
  })

  return candidates.map((list, index) => {
    if (list.length === 0) {
      return { base: onlyDigits(codes[index]), size: normalizeSize('') }
    }
    return list.reduce((best, candidate) => (support[candidate.base] > support[best.base] ? candidate : best))
  })
}

/** Calzado: el talle son los 2 dígitos finales. "71080C011240" → base "710800112", talle "40". */
export function splitFootwearCode(code) {
  const digits = onlyDigits(code)
  if (digits.length < 3) return { base: digits, size: { raw: '', value: null, normalized: false, recognized: false } }
  const size = digits.slice(-2)
  return { base: digits.slice(0, -2), size: { raw: size, value: size, normalized: false, recognized: true } }
}
