// Descomposición de la descripción de un casco contra las tablas de composición del SKU.
// "FF313 AVA ARCANO GLOSS BLACK BLUE" (URBAX) → tipología 10 · calota AVA = 313 · gráfica ARCANO = 22 ·
// color BLACK BLUE GLOSS. Cada parte queda encontrada, deducida, ambigua o nueva (a dar de alta).
// Reglas de oro: no se inventa ningún código y, con más de un candidato, se elige el usuario.
import { ALL_ARTICLES, COLORS, REGLA_CASCOS } from '../data/realData'
import { BRANDS, CUSTOM_CASCOS } from '../engines/engines'
import { FINISHES } from '../rules/descriptions'
import { normalizeText } from './normalize'

export const COMPONENT_STATUS = {
  FOUND: 'encontrado',
  DEDUCED: 'deducido',
  AMBIGUOUS: 'ambiguo',
  NEW: 'nuevo',
  MISSING: 'falta',
}

const MODEL_TOKEN = /^([A-Z]{1,3})(\d{2,4})[A-Z]?$/
const FINISH_ALIASES = { MATTE: 'MATT' }
const canonical = (word) => FINISH_ALIASES[word] ?? word

const tokensOf = (text) =>
  normalizeText(text)
    .replace(/[_/,.;()+-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(canonical)

const sameWords = (a, b) => a.length === b.length && [...a].sort().join(' ') === [...b].sort().join(' ')
const startsWithWords = (tokens, words) => words.length > 0 && words.every((word, index) => tokens[index] === word)

/** Tablas de una marca de cascos con calota (MAC, URBAX y las marcas nuevas de cascos). */
export function cascosCatalog(brandId) {
  if (brandId === 'MAC') return { calotas: REGLA_CASCOS.calotasMAC, graficas: REGLA_CASCOS.graficasMAC }
  if (brandId === 'UBX') return { calotas: REGLA_CASCOS.calotasURBAX, graficas: REGLA_CASCOS.graficasURBAX }
  const custom = CUSTOM_CASCOS[brandId]
  return custom ? { calotas: custom.calotas, graficas: custom.graficas } : null
}

/** ¿La marca arma cascos con calota? (GUD tiene otra estructura y todavía no se descompone.) */
export const supportsDescription = (brandId) => Boolean(cascosCatalog(brandId) && BRANDS.find((brand) => brand.id === brandId)?.lines?.some((line) => line.id === 'cascos'))

const knownColorWords = () =>
  new Set([
    ...REGLA_CASCOS.colores.flatMap((color) => tokensOf(color.descripcion)),
    ...COLORS.flatMap((color) => tokensOf(color.ingles ?? '')),
    ...FINISHES.map((finish) => canonical(finish.name)),
  ])

/** Tipologías que usan los SKU existentes de una marca con esa calota (ej. UBX + 313 → 10). */
function tipologiasOfCalota(brandId, calotaCode) {
  const pattern = new RegExp(`^${brandId}([0-9A-Z]{2})${calotaCode}`)
  return [...new Set(ALL_ARTICLES.filter((article) => article.marca === brandId).map((article) => pattern.exec(article.sku)?.[1]).filter(Boolean))]
}

const part = (id, label, detected, rest) => ({ id, label, detected, options: [], code: '', name: '', reason: '', ...rest })

/**
 * @param {string} description  "FF313 AVA ARCANO GLOSS BLACK BLUE"
 * @returns {{ supported: boolean, parts: Array }}  Partes con su estado, candidatos y qué crear si no existe.
 */
export function decomposeDescription(brandId, description) {
  const catalog = cascosCatalog(brandId)
  if (!catalog || !supportsDescription(brandId)) return { supported: false, parts: [] }

  const tokens = tokensOf(description)
  const modelIndex = tokens.findIndex((token) => MODEL_TOKEN.test(token))
  if (modelIndex === -1) return { supported: true, parts: [], reason: 'No se encontró el modelo (ej.: FF313) en la descripción.' }

  const [, letters, digits] = MODEL_TOKEN.exec(tokens[modelIndex])
  const modelNumber = digits.length === 2 ? `0${digits}` : digits
  let rest = tokens.slice(modelIndex + 1)
  const colorWords = knownColorWords()

  // ── Calota ──
  const byCode = modelNumber.length === 3 ? catalog.calotas.filter((item) => item.codigo === modelNumber) : []
  const byName = catalog.calotas
    .map((item) => ({ item, words: tokensOf(item.descripcion) }))
    .filter(({ words }) => startsWithWords(rest, words))
    .sort((a, b) => b.words.length - a.words.length)
  let calota
  if (byName.length && byCode.length && byName[0].item.codigo !== byCode[0].codigo) {
    const options = [byName[0].item, byCode[0]].map((item) => ({ code: item.codigo, label: item.descripcion }))
    calota = part('calota', 'Calota (modelo)', `${tokens[modelIndex]} ${byName[0].words.join(' ')}`, {
      status: COMPONENT_STATUS.AMBIGUOUS,
      options,
      reason: `El nombre (${byName[0].item.descripcion}) y el número del modelo (${modelNumber}) apuntan a calotas distintas.`,
    })
    rest = rest.slice(byName[0].words.length)
  } else if (byName.length || byCode.length) {
    const found = byName[0]?.item ?? byCode[0]
    calota = part('calota', 'Calota (modelo)', byName.length ? `${tokens[modelIndex]} ${byName[0].words.join(' ')}` : tokens[modelIndex], {
      status: COMPONENT_STATUS.FOUND,
      code: found.codigo,
      name: found.descripcion,
      alta: found.alta,
    })
    if (byName.length) rest = rest.slice(byName[0].words.length)
  } else {
    const name = rest.length && !colorWords.has(rest[0]) ? rest[0] : ''
    calota = part('calota', 'Calota (modelo)', [tokens[modelIndex], name].filter(Boolean).join(' '), {
      status: COMPONENT_STATUS.NEW,
      reason: `${modelNumber} no está en las calotas de ${brandId}.`,
      create: { targetId: `calota-${brandId}`, values: { codigo: modelNumber.length === 3 ? modelNumber : '', descripcion: name } },
    })
    if (name) rest = rest.slice(1)
  }

  // ── Tipología: por los SKU que ya existen con esa calota; si no, por el tipo (FF, MX…) ──
  // Los SKU de una calota incluyen sus repuestos (visor, spoiler…): solo cuentan las tipologías del mismo tipo.
  const byType = REGLA_CASCOS.tipologias.filter((item) => item.tipo === letters)
  const usedCodes = calota.code ? tipologiasOfCalota(brandId, calota.code) : []
  const fromSkus = byType.filter((item) => usedCodes.includes(item.codigo)).map((item) => item.codigo)
  const tipoOptions = (fromSkus.length ? byType.filter((item) => fromSkus.includes(item.codigo)) : byType).map((item) => ({
    code: item.codigo,
    label: item.descripcion,
  }))
  let tipologia
  if (tipoOptions.length === 1) {
    tipologia = part('tipologia', 'Tipología', letters, {
      status: fromSkus.length ? COMPONENT_STATUS.DEDUCED : COMPONENT_STATUS.FOUND,
      code: tipoOptions[0].code,
      name: tipoOptions[0].label,
      reason: fromSkus.length ? `Los SKU existentes de la calota ${calota.code} usan ${tipoOptions[0].label}.` : '',
    })
  } else if (tipoOptions.length > 1) {
    tipologia = part('tipologia', 'Tipología', letters, {
      status: COMPONENT_STATUS.AMBIGUOUS,
      options: tipoOptions,
      reason: `Hay ${tipoOptions.length} tipologías posibles para ${letters}${fromSkus.length ? ` con la calota ${calota.code}` : ''}: elegí una.`,
    })
  } else {
    tipologia = part('tipologia', 'Tipología', letters, { status: COMPONENT_STATUS.MISSING, reason: `No hay tipologías para ${letters}.` })
  }

  // ── Gráfica: la conocida al comienzo, o las palabras antes del primer color / acabado ──
  const graphicMatches = catalog.graficas
    .map((item) => ({ item, words: tokensOf(item.descripcion) }))
    .filter(({ item, words }) => item.descripcion !== 'SIN GRAFICA' && startsWithWords(rest, words))
    .sort((a, b) => b.words.length - a.words.length)
  let grafica
  if (graphicMatches.length) {
    const { item, words } = graphicMatches[0]
    grafica = part('grafica', 'Gráfica', words.join(' '), { status: COMPONENT_STATUS.FOUND, code: item.codigo, name: item.descripcion, alta: item.alta })
    rest = rest.slice(words.length)
  } else {
    const firstColor = rest.findIndex((token) => colorWords.has(token))
    const leading = firstColor === -1 ? rest : rest.slice(0, firstColor)
    if (leading.length) {
      const name = leading.join(' ')
      grafica = part('grafica', 'Gráfica', name, {
        status: COMPONENT_STATUS.NEW,
        reason: `${name} no está en las gráficas de ${brandId}.`,
        create: { targetId: `grafica-${brandId}`, values: { descripcion: name } },
      })
      rest = rest.slice(leading.length)
    } else {
      const plain = catalog.graficas.find((item) => item.descripcion === 'SIN GRAFICA')
      grafica = plain
        ? part('grafica', 'Gráfica', '', {
            status: COMPONENT_STATUS.DEDUCED,
            code: plain.codigo,
            name: plain.descripcion,
            reason: 'La descripción no nombra ninguna gráfica.',
          })
        : part('grafica', 'Gráfica', '', { status: COMPONENT_STATUS.MISSING, reason: 'La descripción no nombra ninguna gráfica.' })
    }
  }

  // ── Color: lo que queda, sin importar el orden (GLOSS BLACK BLUE = BLACK BLUE GLOSS) ──
  let color
  if (rest.length === 0) {
    color = part('color', 'Color', '', { status: COMPONENT_STATUS.MISSING, reason: 'La descripción no indica el color.' })
  } else {
    const detected = rest.join(' ')
    const finishNames = new Set(FINISHES.map((finish) => canonical(finish.name)))
    // El acabado (GLOSS, MATT) va al final en la tabla; en el mail puede venir primero.
    const finishLast = [...rest.filter((word) => !finishNames.has(word)), ...rest.filter((word) => finishNames.has(word))]
    const table = REGLA_CASCOS.colores.map((item) => ({ item, words: tokensOf(item.descripcion) }))
    // El orden importa (BLACK RED ≠ RED BLACK): primero igual al mail, luego con el acabado al final y, por último, sin orden.
    const attempts = [
      table.filter(({ words }) => words.join(' ') === detected),
      table.filter(({ words }) => words.join(' ') === finishLast.join(' ')),
      table.filter(({ words }) => sameWords(words, rest)),
    ]
    const matches = (attempts.find((found) => found.length > 0) ?? []).map(({ item }) => item)
    if (matches.length === 1) {
      color = part('color', 'Color', detected, { status: COMPONENT_STATUS.FOUND, code: matches[0].codigo, name: matches[0].descripcion, alta: matches[0].alta })
    } else if (matches.length > 1) {
      color = part('color', 'Color', detected, {
        status: COMPONENT_STATUS.AMBIGUOUS,
        options: matches.map((item) => ({ code: item.codigo, label: item.descripcion })),
        reason: `Hay ${matches.length} colores con esas palabras: elegí uno.`,
      })
    } else {
      // Nombre para el alta: los colores primero y el acabado (GLOSS, MATT) al final, como en la tabla.
      const name = finishLast.join(' ')
      color = part('color', 'Color', detected, {
        status: COMPONENT_STATUS.NEW,
        reason: `${name} no está en la tabla de colores de cascos.`,
        create: { targetId: 'color-cascos', values: { descripcion: name } },
      })
    }
  }

  return { supported: true, parts: [tipologia, calota, grafica, color] }
}

/** Partes con lo que eligió el usuario aplicado (`choices`: id de parte → código). */
export function applyChoices(parts, choices = {}) {
  return parts.map((item) => {
    const chosen = choices[item.id]
    const option = chosen && item.options.find((candidate) => candidate.code === chosen)
    return option ? { ...item, status: COMPONENT_STATUS.FOUND, code: option.code, name: option.label, reason: '' } : item
  })
}

/** Códigos listos para cargar en el motor: solo lo que quedó resuelto (encontrado o deducido). */
export function selectionsFromParts(parts) {
  return Object.fromEntries(
    parts.filter((item) => item.code && [COMPONENT_STATUS.FOUND, COMPONENT_STATUS.DEDUCED].includes(item.status)).map((item) => [item.id, item.code]),
  )
}

/** Resumen de una descripción para la lista de variantes. */
export function summarizeParts(parts) {
  const count = (status) => parts.filter((item) => item.status === status).length
  return { news: count(COMPONENT_STATUS.NEW), ambiguous: count(COMPONENT_STATUS.AMBIGUOUS), missing: count(COMPONENT_STATUS.MISSING) }
}
