// Motores de armado de SKU para las marcas que no son LS2. Cada motor declara
// sus segmentos; el mismo código arma el SKU, lo descompone (formato y tests)
// y dibuja los selectores con los catálogos reales del JSON.
import {
  ALL_GENERICOS,
  REGLA_CASCOS,
  REGLA_CASCOS_GUD,
  REGLA_PRODUCTO,
  REGLA_PRODUCTO_GUD,
  TALLES_CASCOS,
} from '../data/realData'
import { RULE_STATUS, SOURCES } from '../rules/constants'

const { CONFIRMED, PENDING } = RULE_STATUS

const SHEET = 'CODIFICACION 2023'

/** Catálogo del JSON → opciones únicas por código. */
function options(list = []) {
  const seen = new Set()
  return list.flatMap((item) => {
    if (seen.has(item.codigo)) return []
    seen.add(item.codigo)
    return [{ code: item.codigo, label: item.descripcion }]
  })
}

const familyName = (code) => REGLA_PRODUCTO.familias.find((family) => family.codigo === code)?.descripcion ?? null

// ── Talles ────────────────────────────────────────────────

/** Tabla de talles de cascos (hoja REFERENCIA CASCOS). ".XX" no se ofrece: es un talle viejo = 2X. */
const CASCO_SIZES = TALLES_CASCOS.map((row) => ({ code: row.sufijo, label: row.talle, group: 'Cascos' }))

/**
 * Tabla de talles de producto. Calzado va con punto (".40"), como en los SKUs reales,
 * aunque la hoja de referencia lo tiene sin punto. El grupo INDUMENTARIA solo describe T1–T3.
 */
const PRODUCT_SIZES = (() => {
  const descriptions = Object.fromEntries(
    REGLA_PRODUCTO.talles.filter((row) => row.grupo === 'INDUMENTARIA').map((row) => [row.talle, row.codigo]),
  )
  // Sin repetir dentro de cada grupo (XXL y 2X son .2X); entre grupos se repiten a propósito (.36 en BOTTOM y CALZADO).
  const seen = new Set()
  return REGLA_PRODUCTO.talles
    .filter((row) => row.grupo !== 'INDUMENTARIA')
    .flatMap((row) => {
      const code = row.codigo.startsWith('.') ? row.codigo : `.${row.codigo}`
      if (seen.has(`${row.grupo}${code}`)) return []
      seen.add(`${row.grupo}${code}`)
      const label = code.slice(1)
      return [{ code, label: descriptions[label] ? `${label} · ${descriptions[label]}` : label, group: row.grupo }]
    })
})()

// ── Segmentos ─────────────────────────────────────────────

const fixed = (id, label, value) => ({ id, label, length: value.length, fixed: value })
const select = (id, label, length, getOptions) => ({ id, label, length, getOptions })
const article = (lines) => ({ id: 'articulo', label: 'Artículo', length: 2, article: true, lines })

const PRODUCT_ARTICLE_LINES = Object.entries(REGLA_PRODUCTO.articulosPorModelo).map(([line, items]) => ({
  id: line,
  label: line,
  items: options(items),
}))
const GUD_ARTICLE_LINES = [{ id: 'GUD', label: 'Artículos GUD', items: options(REGLA_PRODUCTO_GUD.articulos) }]

const productSegments = ({ brand, withOrigin = true, tipologias, articleLines, colors }) => [
  ...(withOrigin ? [select('origen', 'Origen', 1, () => options(REGLA_PRODUCTO.origenes))] : []),
  fixed('marca', 'Marca', brand),
  select('familia', 'Familia', 1, () => options(REGLA_PRODUCTO.familias)),
  select('tipologia', 'Tipología', 2, tipologias),
  select('genero', 'Género', 1, () => options(REGLA_PRODUCTO.generos)),
  article(articleLines),
  select('color', 'Color', 2, () => colors),
]

const productTipologias = (selections) => options(REGLA_PRODUCTO.tipologiasPorFamilia[familyName(selections.familia)] ?? [])

// ── Reglas comunes ────────────────────────────────────────

const PRODUCT_RULES = [
  {
    text: 'Sin talle: el producto puede ir sin segmento de talle (51 SKUs reales así).',
    status: PENDING,
    source: `${SHEET}, hojas PROD. MAC y PROD. NTO`,
  },
  {
    text: 'Calzado con punto (".40"), como en los SKUs reales; la tabla de referencia lo tiene sin punto.',
    status: PENDING,
    source: `${SHEET}, hoja de referencia de producto`,
  },
  {
    text: 'Artículo: se elige de la tabla de la línea; si el modelo es nuevo, correlativo 01–99, AA–ZZ, 0A–9Z, A0–Z9.',
    status: CONFIRMED,
    source: `${SHEET}, hoja de referencia de producto`,
  },
  {
    text: 'El correlativo sugerido es el siguiente al más alto usado con ese prefijo (no reutiliza huecos).',
    status: PENDING,
    source: 'Criterio de la herramienta',
  },
]

// ── Motores ───────────────────────────────────────────────

function cascosEngine(brand) {
  const isMac = brand === 'MAC'
  const calotas = options(isMac ? REGLA_CASCOS.calotasMAC : REGLA_CASCOS.calotasURBAX)
  const graficas = options(isMac ? REGLA_CASCOS.graficasMAC : REGLA_CASCOS.graficasURBAX)
  const tipologias = REGLA_CASCOS.tipologias
  return {
    id: `cascos-${brand}`,
    label: 'Cascos y repuestos de casco',
    brand,
    segments: [
      fixed('marca', 'Marca', brand),
      select('tipologia', 'Tipología', 2, () => options(tipologias)),
      select('calota', 'Calota', 3, () => calotas),
      select('grafica', 'Gráfica', 2, () => graficas),
      select('color', 'Color', 2, () => options(REGLA_CASCOS.colores)),
    ],
    sizes: CASCO_SIZES,
    allowNoSize: false,
    legacySizes: ['.XX'],
    genericBrand: brand,
    // Tipologías de casco (FF, MX, OF, ADVENTURE, CROSSOVER) → CASCOS; el resto (visor, pinlock…) → REPUESTOS.
    genericFamily: (selections) => {
      const tipo = tipologias.find((item) => item.codigo === selections.tipologia)?.tipo
      if (!selections.tipologia) return null
      return ['FF', 'MX', 'OF'].includes(tipo) ? 'CASCOS' : 'REPUESTOS'
    },
    rules: [
      {
        text: 'Marca(3) + Tipología(2) + Calota(3) + Gráfica(2) + Color(2) + Talle(3, con el punto). Ej.: MAC939070001.TU.',
        status: CONFIRMED,
        source: `${SHEET}, hoja CASCOS MAC-URX: verificada contra los 2.515 SKUs reales (100%)`,
      },
      {
        text: `Calotas y gráficas según la marca (${isMac ? 'calotasMAC / graficasMAC' : 'calotasURBAX / graficasURBAX'}).`,
        status: CONFIRMED,
        source: `${SHEET}, hoja REFERENCIA CASCOS`,
      },
      { text: 'Talles de la tabla de cascos (2S … 5X, TU).', status: CONFIRMED, source: `${SHEET}, hoja REFERENCIA CASCOS` },
      {
        text: 'Genérico: familia CASCOS en tipologías de casco (FF, MX, OF, ADVENTURE, CROSSOVER) y REPUESTOS en el resto.',
        status: PENDING,
        source: 'CODIFICACION GENERICOS',
      },
    ],
  }
}

function productEngine(brand) {
  const isClimax = brand === 'CLX'
  return {
    id: `producto-${brand}`,
    label: 'Producto',
    brand,
    segments: productSegments({
      brand,
      tipologias: productTipologias,
      articleLines: PRODUCT_ARTICLE_LINES,
      colors: options(REGLA_PRODUCTO.colores),
    }),
    sizes: PRODUCT_SIZES,
    allowNoSize: true,
    genericBrand: brand,
    genericFamily: (selections) => familyName(selections.familia),
    rules: [
      {
        text: 'Origen(1) + Marca(3) + Familia(1) + Tipología(2) + Género(1) + Artículo(2) + Color(2) + Talle(3, con el punto). Ej.: IMAC30010102.S.',
        status: CONFIRMED,
        source: `${SHEET}, hojas PROD. MAC y PROD. NTO: verificada contra 975 de 981 SKUs reales`,
      },
      ...(isClimax
        ? [{ text: 'CLIMAX: marca sin SKUs históricos; se permite generar.', status: PENDING, source: SHEET }]
        : []),
      ...PRODUCT_RULES,
    ],
  }
}

const productGudEngine = {
  id: 'producto-GUD',
  label: 'Producto',
  brand: 'GUD',
  segments: productSegments({
    brand: 'GUD',
    tipologias: () => options(REGLA_PRODUCTO_GUD.tipologias),
    articleLines: GUD_ARTICLE_LINES,
    colors: options(REGLA_PRODUCTO_GUD.colores),
  }),
  sizes: PRODUCT_SIZES,
  allowNoSize: true,
  genericBrand: 'GUD',
  genericFamily: (selections) => familyName(selections.familia),
  rules: [
    {
      text: 'Misma estructura que producto, con tipologías, artículos y colores propios de GUD.',
      status: CONFIRMED,
      source: `${SHEET}, hoja PROD. GUD: verificada contra los 288 SKUs reales`,
    },
    {
      text: 'Artículo de 2 dígitos: la hoja REF. INDUMENTARIA GUD dice 3, pero los 288 SKUs reales usan 2.',
      status: PENDING,
      source: `${SHEET}, hoja REF. INDUMENTARIA GUD`,
    },
    ...PRODUCT_RULES,
  ],
}

const cascosGudEngine = {
  id: 'cascos-GUD',
  label: 'Cascos',
  brand: 'GUD',
  segments: [
    fixed('marca', 'Marca', 'GUD'),
    select('tipologia', 'Tipología', 2, () => options(REGLA_CASCOS_GUD.tipologias)),
    select('grafica', 'Gráfica', 2, () => options(REGLA_CASCOS_GUD.graficas)),
    select('acabado', 'Acabado', 2, () => options(REGLA_CASCOS_GUD.acabados)),
    select('color', 'Color', 2, () => options(REGLA_CASCOS_GUD.colores)),
  ],
  sizes: CASCO_SIZES,
  allowNoSize: false,
  genericBrand: 'GUD',
  genericFamily: () => 'CASCOS',
  rules: [
    {
      text: 'GUD(3) + Tipología(2) + Gráfica(2) + Acabado(2) + Color(2) + Talle(3, con el punto). Ej.: GUD92030102.S.',
      status: CONFIRMED,
      source: `${SHEET}, hoja CASCOS GUD: verificada contra los 27 SKUs reales (100%)`,
    },
    {
      text: 'La hoja REF. CASCOS GUD describe otra estructura: Familia(1) + Género(1) + Gráfica(3), que sumaría 17 caracteres.',
      status: PENDING,
      source: `${SHEET}, hoja REF. CASCOS GUD`,
      note: REGLA_CASCOS_GUD.nota,
    },
    { text: 'Talles de la tabla de cascos (2S … 5X, TU).', status: CONFIRMED, source: `${SHEET}, hoja REFERENCIA CASCOS` },
  ],
}

const product921Engine = {
  id: 'producto-921',
  label: 'Producto',
  brand: '921',
  segments: productSegments({
    brand: '921',
    withOrigin: false,
    tipologias: productTipologias,
    articleLines: PRODUCT_ARTICLE_LINES,
    colors: options(REGLA_PRODUCTO.colores),
  }),
  sizes: PRODUCT_SIZES,
  allowNoSize: true,
  genericBrand: '921',
  genericFamily: (selections) => familyName(selections.familia),
  rules: [
    {
      text: 'Misma estructura que producto, sin la letra de origen. Ej.: 92161110102.S.',
      status: PENDING,
      source: `${SHEET}, hoja SERVICOM (12 SKUs reales)`,
    },
    ...PRODUCT_RULES,
  ],
}

// ── Marcas y líneas ───────────────────────────────────────

export const ENGINES = {
  cascosMAC: cascosEngine('MAC'),
  cascosUBX: cascosEngine('UBX'),
  productoMAC: productEngine('MAC'),
  productoNTO: productEngine('NTO'),
  productoCLX: productEngine('CLX'),
  productoGUD: productGudEngine,
  cascosGUD: cascosGudEngine,
  producto921: product921Engine,
}

export const BRANDS = [
  { id: 'LS2', label: 'LS2', lines: null },
  {
    id: 'MAC',
    label: 'MAC',
    lines: [
      { id: 'cascos', label: 'Cascos y repuestos de casco', engine: ENGINES.cascosMAC },
      { id: 'producto', label: 'Producto', engine: ENGINES.productoMAC },
    ],
  },
  { id: 'UBX', label: 'URBAX', lines: [{ id: 'cascos', label: 'Cascos y repuestos de casco', engine: ENGINES.cascosUBX }] },
  { id: 'NTO', label: 'NTO', lines: [{ id: 'producto', label: 'Producto', engine: ENGINES.productoNTO }] },
  {
    id: 'GUD',
    label: 'GUD',
    lines: [
      { id: 'cascos', label: 'Cascos', engine: ENGINES.cascosGUD },
      { id: 'producto', label: 'Producto', engine: ENGINES.productoGUD },
    ],
  },
  { id: 'CLX', label: 'CLIMAX', lines: [{ id: 'producto', label: 'Producto', engine: ENGINES.productoCLX }] },
  { id: '921', label: '921', lines: [{ id: 'producto', label: 'Producto', engine: ENGINES.producto921 }] },
]

/** Genéricos de la marca y familia (sin preselección). */
export function genericosFor(engine, selections) {
  const familia = engine.genericFamily(selections)
  if (!familia) return []
  return ALL_GENERICOS.filter((generico) => generico.marca === engine.genericBrand && generico.familia === familia)
}

export function brandHasGenericos(engine) {
  return ALL_GENERICOS.some((generico) => generico.marca === engine.genericBrand)
}

// ── Armado y descomposición ───────────────────────────────

const SIZE_PATTERN = '(\\.[0-9A-Z]{1,2})'

/** Expresión regular de la estructura del motor (segmentos + talle). */
export function enginePattern(engine) {
  const body = engine.segments
    .map((segment) => (segment.fixed ? `(${segment.fixed})` : `([0-9A-Z]{${segment.length}})`))
    .join('')
  return new RegExp(`^${body}${SIZE_PATTERN}${engine.allowNoSize ? '?' : ''}$`)
}

/**
 * Descompone un SKU en los segmentos del motor.
 * "MAC939070001.TU" → { marca: MAC, tipologia: 93, calota: 907, grafica: 00, color: 01 }, talle ".TU".
 * Devuelve null si no respeta la estructura.
 */
export function decomposeSku(engine, sku) {
  const match = enginePattern(engine).exec(sku)
  if (!match) return null
  const values = Object.fromEntries(engine.segments.map((segment, index) => [segment.id, match[index + 1]]))
  return { values, size: match[engine.segments.length + 1] ?? '' }
}

/** Parte del SKU antes del artículo (prefijo para el correlativo). */
export function prefixBeforeArticle(engine, selections) {
  const parts = []
  for (const segment of engine.segments) {
    if (segment.article) return parts.join('')
    const value = segment.fixed ?? selections[segment.id]
    if (!value) return null
    parts.push(value)
  }
  return null
}

// ── Reglas generales de los motores ───────────────────────

export const ENGINE_GENERAL_RULES = [
  { text: 'Largo máximo 15 caracteres.', status: RULE_STATUS.CONFIRMED, source: SOURCES.TANGO },
  { text: 'Todo en MAYÚSCULAS.', status: RULE_STATUS.CONFIRMED, source: SOURCES.MEETING_18_09 },
  {
    text: 'Todo SKU debe tener código genérico, de la lista filtrada por marca y familia.',
    status: RULE_STATUS.CONFIRMED,
    source: SOURCES.FUNCTIONAL_SPEC,
  },
  {
    text: 'CLIMAX y 921 no tienen genéricos cargados: se advierte en lugar de bloquear.',
    status: RULE_STATUS.PENDING,
    source: 'CODIFICACION GENERICOS',
  },
  { text: 'EAN opcional; si se carga, 13 dígitos con dígito verificador válido.', status: RULE_STATUS.CONFIRMED, source: SOURCES.GS1 },
  { text: 'Descripción manual en esta etapa; la generación automática queda para después.', status: RULE_STATUS.PENDING, source: 'Etapa D' },
  { text: 'Sinónimo: es un campo de Tango, pero no está definido qué se valida.', status: RULE_STATUS.UNDEFINED, source: SOURCES.PROCESS_DOCS },
]
