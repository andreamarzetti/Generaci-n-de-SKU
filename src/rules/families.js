import { OFFICIAL_SIZES } from '../data/realData'
import { MAX_SKU_LENGTH, MIN_SKU_LENGTH, RULE_STATUS, SOURCES } from './constants'
import { COLOR_ALIASES, MAX_TANGO_DESCRIPTION } from './descriptions'

const { CONFIRMED, PENDING, UNDEFINED } = RULE_STATUS

/**
 * Esquemas de armado:
 *  - cascos:        LS2 + 7 primeros dígitos del código de barras + 2 dígitos libres + .TALLE
 *  - talleSufijo:   LS2 + código del proveedor sin letras + .TALLE
 *  - calzado:       LS2 + código del proveedor sin letras + .TALLE numérico (2 dígitos finales)
 *  - codigoLibre:   LS2 + código del proveedor (puede tener letras), sin punto ni talle
 *  - talleUnico:    LS2 + código del proveedor + .TU
 */
const LETTER_SIZES = OFFICIAL_SIZES.join('|')

const SEVEN_PLUS_TWO_QUESTION = {
  text: 'Si la regla de 7 dígitos del código de barras + 2 libres aplica también a esta familia.',
  status: PENDING,
  source: SOURCES.STEP_BY_STEP_21_09,
}

const SUPPLIER_CODES_FIELD = {
  name: 'codigos',
  label: 'Códigos del proveedor',
  type: 'lines',
  placeholder: 'Separá los códigos con ";", con el talle al final\n64240W0112S; 64240W0112M; 64240W0112L',
  hint: 'Cada ";" separa un código. Se quitan las letras intermedias y el talle final pasa después del punto.',
}

const SIZE_SUFFIX_RULES = [
  {
    text: 'LS2 + código del proveedor sin letras intermedias + "." + talle (64240W0112S → LS2642400112.S).',
    status: PENDING,
    source: SOURCES.REAL_DATA,
  },
  {
    text: 'Si el talle final es ambiguo (…1123XL), se toma la base que comparten los demás códigos del modelo.',
    status: PENDING,
    source: SOURCES.REAL_DATA,
  },
  SEVEN_PLUS_TWO_QUESTION,
]

function sizeSuffixFamily(id, label, familia) {
  return {
    id,
    label,
    familia,
    scheme: 'talleSufijo',
    hasSize: true,
    fields: [SUPPLIER_CODES_FIELD],
    formatPattern: new RegExp(`^LS2\\d+\\.(${LETTER_SIZES})$`),
    formatHint: 'LS2 + dígitos del código del proveedor + .TALLE',
    rules: SIZE_SUFFIX_RULES,
  }
}

function singleSizeFamily(id, label, familia) {
  return {
    id,
    label,
    familia,
    scheme: 'talleUnico',
    hasSize: false,
    fields: [
      {
        name: 'codigo',
        label: 'Códigos del proveedor',
        type: 'code',
        placeholder: 'Ej.: 8105057; 8105058',
        hint: 'Para cargar varios, separalos con ";".',
      },
    ],
    formatPattern: /^LS2[A-Z0-9]+\.TU$/,
    formatHint: 'LS2 + código del proveedor + .TU',
    rules: [
      { text: 'La nomenclatura termina en .TU (talle único).', status: PENDING, source: SOURCES.AREA_RULE_MERCH },
      { text: 'La base es LS2 + código del proveedor (caso real de Merch: LS28105057.TU).', status: PENDING, source: SOURCES.AREA_RULE_MERCH },
      SEVEN_PLUS_TWO_QUESTION,
    ],
  }
}

export const FAMILIES = {
  cascos: {
    id: 'cascos',
    label: 'Cascos',
    familia: 'CASCOS',
    scheme: 'cascos',
    hasSize: true,
    fields: [
      {
        name: 'talles',
        label: 'Talles recibidos',
        type: 'sizes',
        options: OFFICIAL_SIZES.filter((size) => size !== 'TU'),
        hint: 'Un SKU por talle. El código de barras, el EAN y el precio de cada talle se cargan en la tabla.',
      },
    ],
    formatPattern: new RegExp(`^LS2\\d{7}[0-9A-Z]{2}\\.(${LETTER_SIZES})$`),
    formatHint: 'LS2 + 7 dígitos del código de barras + 2 dígitos libres + .TALLE',
    rules: [
      {
        text: 'LS2 + primeros 7 dígitos del código de barras + 2 dígitos libres + "." + talle.',
        status: CONFIRMED,
        source: SOURCES.STEP_BY_STEP_21_09,
      },
      {
        text: 'Los 2 dígitos libres no pueden estar usados con el mismo prefijo de 7 dígitos.',
        status: CONFIRMED,
        source: SOURCES.STEP_BY_STEP_21_09,
      },
      {
        text: 'Orden de los 2 dígitos libres: 01–99; si se agotan, A1…A9, A0, B1…B0 hasta Z0 y luego 1A…9A, 0A hasta 0Z.',
        status: CONFIRMED,
        source: SOURCES.AREA_RULE,
      },
    ],
  },
  indumentaria: sizeSuffixFamily('indumentaria', 'Indumentaria', 'INDUMENTARIA'),
  guantes: sizeSuffixFamily('guantes', 'Guantes', 'GUANTES'),
  cordura: sizeSuffixFamily('cordura', 'Cordura', 'CORDURA'),
  calzado: {
    id: 'calzado',
    label: 'Calzado',
    familia: 'CALZADO',
    scheme: 'calzado',
    hasSize: true,
    fields: [
      {
        ...SUPPLIER_CODES_FIELD,
        placeholder: 'Separá los códigos con ";", con el talle al final\n71080C011240; 71080C011241',
        hint: 'Cada ";" separa un código. Los 2 dígitos finales son el talle (.40, .41…).',
      },
    ],
    formatPattern: /^LS2\d+\.\d{2}$/,
    formatHint: 'LS2 + dígitos del código del proveedor + .TALLE numérico',
    rules: [
      {
        text: 'LS2 + código del proveedor sin letras intermedias + "." + talle (71080C011240 → LS2710800112.40).',
        status: PENDING,
        source: SOURCES.REAL_DATA,
      },
      { text: 'Talles numéricos: los 2 dígitos finales del código (.40, .41…).', status: PENDING, source: SOURCES.REAL_DATA },
      SEVEN_PLUS_TWO_QUESTION,
    ],
  },
  rainwear: sizeSuffixFamily('rainwear', 'Rainwear', 'RAINWEAR'),
  equipaje: singleSizeFamily('equipaje', 'Equipaje', 'EQUIPAJE'),
  accesorios: singleSizeFamily('accesorios', 'Accesorios', 'ACCESORIOS'),
  repuestos: {
    id: 'repuestos',
    label: 'Repuestos',
    familia: 'REPUESTOS',
    scheme: 'codigoLibre',
    hasSize: false,
    fields: [
      {
        name: 'codigo',
        label: 'Códigos del proveedor',
        type: 'code',
        placeholder: 'Ej.: 800562VIO01; 800562VIO02',
        hint: 'Para cargar varios, separalos con ";".',
      },
    ],
    formatPattern: /^LS2[A-Z0-9]+$/,
    formatHint: 'LS2 + código del proveedor, sin punto ni talle',
    rules: [
      {
        text: 'LS2 + código del proveedor, que puede tener letras, sin punto ni talle (LS2800562VIO01).',
        status: PENDING,
        source: SOURCES.REAL_DATA,
      },
      {
        text: 'Códigos de 8, 11 o 12 caracteres. En los datos reales hay códigos de 7 a 11 caracteres; no se controla.',
        status: PENDING,
        source: SOURCES.AREA_RULE,
      },
      SEVEN_PLUS_TWO_QUESTION,
    ],
  },
}

export const FAMILY_LIST = Object.values(FAMILIES)

export const GENERAL_RULES = [
  {
    text: `Largo máximo ${MAX_SKU_LENGTH} caracteres; no es exacto (en los datos reales, 167 SKUs tienen 14 y 105 tienen 15). Sin relleno con ceros.`,
    status: CONFIRMED,
    source: SOURCES.TANGO,
  },
  { text: `Largo mínimo recomendado ${MIN_SKU_LENGTH} caracteres (si es menor, advertencia).`, status: CONFIRMED, source: SOURCES.PROCESS_DOCS },
  { text: 'Todo en MAYÚSCULAS.', status: CONFIRMED, source: SOURCES.MEETING_18_09 },
  {
    text: 'Talles según la tabla oficial (2S, XS, S, M, L, XL, 2X, 3X, 4X, 5X, TU). XXL/2XL → 2X, XXX/3XL → 3X, 4XL → 4X, 5XL → 5X.',
    status: CONFIRMED,
    source: SOURCES.SIZE_TABLE,
  },
  { text: 'Todo SKU debe tener código genérico asociado.', status: CONFIRMED, source: SOURCES.FUNCTIONAL_SPEC },
  {
    text: 'SKU genérico: el mismo SKU sin el talle (.S, .M, .XL…). Se da de alta uno por variante, además de un SKU por talle.',
    status: CONFIRMED,
    source: SOURCES.AREA_RULE,
  },
  {
    text: 'Un genérico nuevo (alta de referencia) queda pendiente: el SKU que lo usa se bloquea hasta aceptar su creación.',
    status: CONFIRMED,
    source: SOURCES.AREA_RULE,
  },
  { text: 'EAN de 13 dígitos con dígito verificador válido.', status: CONFIRMED, source: SOURCES.GS1 },
  {
    text: 'Descripción Tango: colores en inglés → abreviatura (seguidos, unidos con "/"), GLOSS → GS, MATT/MATTE → MT y el talle al final.',
    status: CONFIRMED,
    source: SOURCES.COLOR_TABLE,
  },
  {
    text: `Descripción Tango de hasta ${MAX_TANGO_DESCRIPTION} caracteres (si supera, advertencia).`,
    status: PENDING,
    source: SOURCES.REAL_DATA,
    note: 'Los datos históricos no superan 30, pero el ejemplo del 21/09 tiene 34.',
  },
  {
    text: `Equivalencias de colores fuera de la tabla: ${COLOR_ALIASES.map((alias) => `${alias.name} → ${alias.abbr}`).join(', ')}.`,
    status: PENDING,
    source: SOURCES.COLOR_TABLE,
    note: 'GRAY → GY está respaldada por el ejemplo del 21/09 (LIGHT GY/RD).',
  },
  { text: 'Descripción GS1: solo letras, sin números ni caracteres especiales.', status: CONFIRMED, source: SOURCES.PROCESS_DOCS },
  { text: 'Cómo se indica el talle en la descripción GS1 (solo acepta letras). Hoy se excluye.', status: PENDING, source: SOURCES.PROCESS_DOCS },
  { text: 'Números del modelo en la descripción GS1: se quitan sin conversión (FF806 → "FF").', status: PENDING, source: SOURCES.PROCESS_DOCS },
  { text: 'Carga por lote: LS2 siempre envía el código del proveedor.', status: PENDING, source: SOURCES.HISTORIC_EXCEL },
  { text: 'Sinónimo: es un campo de Tango, pero no está definido qué se valida.', status: UNDEFINED, source: SOURCES.PROCESS_DOCS },
]

export function emptyForm(family) {
  return {
    descripcion: '',
    generico: '',
    ...Object.fromEntries(family.fields.map((field) => [field.name, field.type === 'sizes' ? [] : ''])),
  }
}
