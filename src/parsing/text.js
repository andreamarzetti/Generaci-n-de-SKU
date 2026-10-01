import { isValidGtin } from '../utils/gtin'
import { normalizeText } from './normalize'

const THIRTEEN_DIGITS = /\b\d{13}\b/g
const MODEL_TOKEN = /\b[A-Z]{1,3}\d{2,4}[A-Z]?\b/g

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const wordRegex = (word) => new RegExp(`(^|[^A-Z0-9])${escape(word)}([^A-Z0-9]|$)`)

/** Nombres del catálogo que aparecen como palabra completa en el texto. */
export function findNames(text, catalog, key) {
  return catalog.filter((item) => item.names.some((name) => wordRegex(name).test(text))).map((item) => item[key])
}

/** Modelos mencionados (FF806, MX701…), en orden de aparición. */
export function findModelTokens(text) {
  return [...new Set(text.match(MODEL_TOKEN) ?? [])]
}

/**
 * Clasifica los números de 13 dígitos de una línea:
 * 1) por la palabra más cercana antes del número ("barras", "EAN");
 * 2) si no hay palabras, por el dígito verificador GS1 (válido → EAN, inválido → barras);
 * 3) si no se puede decidir, queda sin clasificar para que elija el usuario.
 */
export function classifyNumbers(line) {
  const matches = [...line.matchAll(THIRTEEN_DIGITS)]
  const result = { barras: null, ean: null, unresolved: [] }

  matches.forEach((match) => {
    const before = line.slice(Math.max(0, match.index - 24), match.index)
    const keywords = [...before.matchAll(/BARRAS|COD(IGO)?|EAN/g)]
    const nearest = keywords.at(-1)?.[0]
    const number = match[0]
    if (nearest === 'EAN' && !result.ean) result.ean = { value: number, how: 'detected', reason: 'Indicado como "EAN" en el texto' }
    else if (nearest && nearest !== 'EAN' && !result.barras)
      result.barras = { value: number, how: 'detected', reason: 'Indicado como "barras" en el texto' }
    else result.unresolved.push(number)
  })

  // Sin palabras clave: se usa el dígito verificador, solo si deja una única asignación posible.
  if (result.unresolved.length > 0) {
    const valid = result.unresolved.filter(isValidGtin)
    const invalid = result.unresolved.filter((number) => !isValidGtin(number))
    if (!result.ean && valid.length === 1) {
      result.ean = { value: valid[0], how: 'deduced', reason: 'Dígito verificador GS1 válido: probablemente EAN' }
      result.unresolved = result.unresolved.filter((number) => number !== valid[0])
    }
    if (!result.barras && invalid.length === 1 && result.ean) {
      result.barras = {
        value: invalid[0],
        how: 'deduced',
        reason: 'No es un EAN válido y la línea ya tiene EAN: probablemente código de barras',
      }
      result.unresolved = result.unresolved.filter((number) => number !== invalid[0])
    }
  }
  return result
}

/** Talles de un rango "S a 2X", "S al 2X", "S-XL" o "S hasta 2X", según el orden oficial. */
export function sizesFromRange(text, { sizeOrder, normalizeSize }) {
  const token = '([0-9A-Z]{1,4})'
  const separator = '(?:\\s*-\\s*|\\s+(?:HASTA|AL|A)\\s+)'
  const pattern = new RegExp(`(?:^|[^A-Z0-9])${token}${separator}${token}(?=[^A-Z0-9]|$)`, 'g')
  for (const match of text.matchAll(pattern)) {
    const from = normalizeSize(match[1])
    const to = normalizeSize(match[2])
    if (!from.recognized || !to.recognized) continue
    const start = sizeOrder.indexOf(from.value)
    const end = sizeOrder.indexOf(to.value)
    if (start === -1 || end === -1 || end < start) continue
    return { sizes: sizeOrder.slice(start, end + 1), raw: match[0].trim() }
  }
  return null
}

/** Talle al principio de la línea: "S: barras …", "XXL - EAN …". */
export function leadingSize(line, { normalizeSize }) {
  const match = /^\s*([0-9A-Z]{1,4})\s*[:\-–]\s+/.exec(line)
  if (!match) return null
  const size = normalizeSize(match[1])
  return size.recognized ? size : null
}

/** Descripción: desde el modelo hasta la primera coma, punto o la palabra "TALLE". */
export function descriptionFromLine(line, model) {
  const start = line.indexOf(model)
  if (start === -1) return ''
  const tail = line.slice(start)
  const end = tail.search(/,|\.(\s|$)|\sTALLES?\b|\n/)
  return (end === -1 ? tail : tail.slice(0, end)).trim()
}

const VARIANT_LINE = /^[A-Z]{1,3}\d{2,4}[A-Z]?_/

/**
 * Variantes pedidas como códigos con guiones bajos, una por línea
 * ("FF313_AVA_ARCANO_GLOSS_BLACK_PINK" → "FF313 AVA ARCANO GLOSS BLACK PINK").
 * Recibe las líneas ya normalizadas, con los guiones bajos todavía puestos.
 */
export function findVariants(lines) {
  const variants = lines
    .filter((line) => VARIANT_LINE.test(line))
    .map((line) => line.replace(/_+/g, ' ').replace(/[\s,;.]+$/, '').replace(/\s+/g, ' ').trim())
  return [...new Set(variants)]
}

/** Interpreta el cuerpo de un mail (sin la tabla). Todo en mayúsculas y sin acentos. */
export function readText(lines, catalogs) {
  const rawLines = lines.map(normalizeText).filter(Boolean)
  const variants = findVariants(rawLines)
  // El guion bajo pega las palabras entre sí: se trata como espacio para reconocer modelo, marca y familia.
  const normalizedLines = rawLines.map((line) => line.replace(/_+/g, ' '))
  const text = normalizedLines.join('\n')

  const brands = findNames(text, catalogs.brands, 'id')
  const families = findNames(text, catalogs.families, 'familia')
  const models = findModelTokens(text)
  const range = sizesFromRange(text, catalogs)

  const rows = []
  normalizedLines.forEach((line) => {
    const size = leadingSize(line, catalogs)
    const numbers = classifyNumbers(line)
    const hasNumbers = numbers.barras || numbers.ean || numbers.unresolved.length
    if (!size && !hasNumbers) return
    rows.push({ size, ...numbers })
  })

  const modelLine = models.length ? normalizedLines.find((line) => line.includes(models[0])) : null
  return {
    brands,
    families,
    models,
    range,
    rows,
    variants,
    // Con varias variantes no hay una única descripción: se elige una en la revisión.
    description: modelLine && variants.length <= 1 ? descriptionFromLine(modelLine, models[0]) : '',
  }
}
