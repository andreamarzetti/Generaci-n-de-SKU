import { COLORS } from '../data/realData'
import { normalizeSize } from './sizes'

export const MAX_TANGO_DESCRIPTION = 30

/**
 * Equivalencias que no están (o están mal escritas) en la tabla de colores.
 * A validar: GRAY → GY está respaldada por el ejemplo del 21/09 (LIGHT GY/RD).
 */
export const COLOR_ALIASES = [
  { name: 'GREEN', abbr: 'GR', note: 'la tabla dice "GREEEN"' },
  { name: 'TURQUOISE', abbr: 'TUQ', note: 'la tabla dice "TURQOISE"' },
  { name: 'GRAY', abbr: 'GY', note: 'la tabla solo tiene GREY' },
  { name: 'HI VIS YELLOW', abbr: 'HVY', note: 'la tabla dice "HIGT V YELLOW"' },
]

export const FINISHES = [
  { name: 'GLOSS', abbr: 'GS' },
  { name: 'MATTE', abbr: 'MT' },
  { name: 'MATT', abbr: 'MT' },
]

const stripAccents = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '')
const words = (text) => text.split(/\s+/).filter(Boolean)

// Colores en inglés de la tabla + equivalencias, del nombre más largo al más corto.
// Se recalcula si la tabla cambió (altas de colores de LS2 dadas de alta después de cargar la página).
let colorPhrasesCache = { size: -1, phrases: [] }
function colorPhrases() {
  if (colorPhrasesCache.size !== COLORS.length) {
    colorPhrasesCache = {
      size: COLORS.length,
      phrases: [
        ...COLORS.filter((color) => color.ingles).map((color) => ({ words: words(color.ingles), abbr: color.abreviatura })),
        ...COLOR_ALIASES.map((alias) => ({ words: words(alias.name), abbr: alias.abbr, alias: true })),
      ].sort((a, b) => b.words.length - a.words.length || b.words.join(' ').length - a.words.join(' ').length),
    }
  }
  return colorPhrasesCache.phrases
}

const FINISH_BY_NAME = Object.fromEntries(FINISHES.map((finish) => [finish.name, finish.abbr]))

function matchColor(tokens, index) {
  return colorPhrases().find((phrase) => phrase.words.every((word, offset) => tokens[index + offset] === word))
}

/** Quita el talle final de una descripción ("FF808 ROAD BK MT XXL" → "FF808 ROAD BK MT"). */
export function descriptionWithoutSize(description = '', sizeValue = null) {
  const tokens = words(stripAccents(String(description).toUpperCase()))
  const last = tokens.at(-1)
  if (last && tokens.length > 1 && (last === sizeValue || normalizeSize(last).recognized)) tokens.pop()
  return tokens.join(' ')
}

/**
 * Descripción Tango: mayúsculas, colores en inglés → abreviatura (colores seguidos
 * se unen con "/"), GLOSS → GS, MATT/MATTE → MT y el talle al final.
 * "FF806 FUSION TECK LIGHT GRAY RED GLOSS" + S → "FF806 FUSION TECK LIGHT GY/RD GS S"
 */
export function tangoDescription(description, sizeValue) {
  const tokens = words(descriptionWithoutSize(description, sizeValue))
  const parts = []
  const replacements = []
  let previousWasColor = false

  for (let index = 0; index < tokens.length; ) {
    const color = matchColor(tokens, index)
    if (color) {
      const from = tokens.slice(index, index + color.words.length).join(' ')
      replacements.push({ from, to: color.abbr, alias: Boolean(color.alias) })
      if (previousWasColor) parts[parts.length - 1] += `/${color.abbr}`
      else parts.push(color.abbr)
      previousWasColor = true
      index += color.words.length
      continue
    }
    const token = tokens[index]
    if (FINISH_BY_NAME[token]) {
      replacements.push({ from: token, to: FINISH_BY_NAME[token], alias: false })
      parts.push(FINISH_BY_NAME[token])
    } else {
      parts.push(token)
    }
    previousWasColor = false
    index += 1
  }

  if (sizeValue) parts.push(sizeValue)
  const text = parts.join(' ')
  return { text, length: text.length, overLimit: text.length > MAX_TANGO_DESCRIPTION, replacements }
}

/**
 * Descripción GS1: solo letras. Se quita el talle y los números
 * (FF806 queda "FF", sin inventar conversión); los separadores pasan a espacio.
 */
export function gs1Description(tangoText = '', sizeValue = null) {
  return descriptionWithoutSize(tangoText, sizeValue)
    .replace(/\d+/g, '')
    .replace(/[^A-Z\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
