import { normalizeSize } from './sizes'

export const BATCH_COLUMNS = ['Descripción', 'Código de barras', 'EAN', 'Talle', 'Código proveedor (opcional)']

// Orden por defecto de las columnas cuando el texto pegado no trae encabezado.
const DEFAULT_ORDER = ['descripcion', 'barras', 'ean', 'talle', 'codigo']

// Cómo se reconoce cada columna en el encabezado (tal como viene en el Excel o en el mail de LS2).
const HEADER_PATTERNS = [
  ['barras', /barra/i],
  ['ean', /ean|gtin/i],
  ['talle', /talle|size|medida/i],
  ['descripcion', /descrip|art[ií]culo|producto/i],
  ['codigo', /c[oó]d|proveedor|sku|ref/i],
]

// Familias donde el código del proveedor es obligatorio en el lote (sin él no hay SKU).
const CODE_REQUIRED = ['talleSufijo', 'calzado', 'codigoLibre', 'talleUnico']

const onlyDigits = (value = '') => String(value).replace(/\D/g, '')
const clean = (value = '') => String(value).trim()

/**
 * Separa una línea en columnas. Acepta lo que queda al copiar una tabla de Excel
 * o de un mail: tabulaciones, ";", "|" o dos o más espacios seguidos.
 */
function splitLine(line) {
  const trimmed = line.trim().replace(/^\||\|$/g, '')
  if (trimmed.includes('\t')) return trimmed.split('\t')
  if (trimmed.includes(';')) return trimmed.split(';')
  if (trimmed.includes('|')) return trimmed.split('|')
  return trimmed.split(/\s{2,}/)
}

/** Líneas de adorno de las tablas de texto plano ("-----", "|---|---|"). */
const isRuler = (cells) => cells.every((cell) => /^[-=_:+\s]*$/.test(cell))

/** Si la fila es un encabezado, devuelve qué campo hay en cada columna; si no, null. */
function headerColumns(cells) {
  const columns = cells.map((cell) => HEADER_PATTERNS.find(([, pattern]) => pattern.test(cell))?.[0] ?? null)
  const known = columns.filter(Boolean)
  const looksLikeData = cells.some((cell) => onlyDigits(cell).length >= 7)
  return known.length >= 2 && !looksLikeData ? columns : null
}

/** Talle de la columna, según la familia (calzado usa talles numéricos). */
function parseSize(raw, family) {
  if (!family.hasSize) return null
  if (family.scheme === 'calzado') {
    const digits = onlyDigits(raw)
    return digits.length === 2
      ? { raw, value: digits, normalized: false, recognized: true }
      : { raw, value: null, normalized: false, recognized: false }
  }
  return normalizeSize(raw)
}

/**
 * Separa la base del código del proveedor usando el talle de la columna,
 * lo que resuelve los casos ambiguos (…01123XL con talle 3XL → base …0112).
 */
function splitCodeBySize(code, size) {
  const suffix = [size.raw, size.value].find((candidate) => candidate && code.endsWith(candidate))
  if (!suffix) return null
  return onlyDigits(code.slice(0, -suffix.length))
}

/**
 * Lee un bloque pegado (copiado de Excel o del mail de LS2), una fila por línea:
 * Descripción · Código de barras · EAN · Talle · Código proveedor (opcional).
 * Si trae encabezado, las columnas se toman por nombre y pueden venir en cualquier orden.
 * Devuelve una fila por línea, con sus errores de lectura.
 */
export function parseBatch(text, family) {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((line, index) => ({ number: index + 1, cells: splitLine(line).map(clean) }))
    .filter(({ cells }) => cells.some(Boolean) && !isRuler(cells))

  const header = lines.length > 0 ? headerColumns(lines[0].cells) : null
  const hasHeader = Boolean(header)
  const columns = header ?? DEFAULT_ORDER
  const body = hasHeader ? lines.slice(1) : lines
  const codeRequired = CODE_REQUIRED.includes(family.scheme)
  const missingColumns = ['descripcion', 'barras', 'ean', 'talle'].filter((name) => !columns.includes(name))

  const rows = body.map(({ number, cells }, index) => {
    const value = (name) => {
      const position = columns.indexOf(name)
      return position >= 0 ? (cells[position] ?? '') : ''
    }
    const descripcion = value('descripcion')
    const talleRaw = value('talle')
    const codigo = value('codigo').toUpperCase().replace(/\s+/g, '')
    const size = parseSize(talleRaw.toUpperCase(), family)
    const errors = []

    if (hasHeader ? missingColumns.length > 0 : cells.length < 4) {
      errors.push('Faltan columnas: se esperan Descripción, Código de barras, EAN y Talle')
    }
    if (size && !size.recognized) errors.push(talleRaw ? `Talle "${talleRaw}" fuera de la tabla oficial` : 'Falta el talle')

    let base = null
    if (codeRequired && !codigo) {
      errors.push(`Falta el código del proveedor (obligatorio para ${family.label})`)
    } else if (codigo && ['talleSufijo', 'calzado'].includes(family.scheme)) {
      base = size?.recognized ? splitCodeBySize(codigo, size) : null
      if (size?.recognized && base === null) errors.push(`El código ${codigo} no termina en el talle ${size.raw}`)
      else if (base === '') errors.push(`El código ${codigo} no tiene dígitos para armar el SKU`)
    }

    return {
      key: `L${index + 1}`,
      line: number,
      descripcion: descripcion.toUpperCase(),
      barras: onlyDigits(value('barras')),
      ean: onlyDigits(value('ean')),
      size,
      codigo,
      base,
      errors,
    }
  })

  return { rows, hasHeader }
}
