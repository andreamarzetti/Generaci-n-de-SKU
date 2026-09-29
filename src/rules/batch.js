import { normalizeSize } from './sizes'

export const BATCH_COLUMNS = ['Descripción', 'Código de barras', 'EAN', 'Talle', 'Código proveedor (opcional)']

// Familias donde el código del proveedor es obligatorio en el lote (sin él no hay SKU).
const CODE_REQUIRED = ['talleSufijo', 'calzado', 'codigoLibre', 'talleUnico']

const onlyDigits = (value = '') => String(value).replace(/\D/g, '')
const clean = (value = '') => String(value).trim()

function isHeader(cells) {
  return cells.some((cell) => /descrip|ean|talle|c[oó]digo/i.test(cell))
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
 * Lee un bloque pegado desde Excel (columnas separadas por tabulación):
 * Descripción · Código de barras · EAN · Talle · Código proveedor (opcional).
 * Devuelve una fila por línea, con sus errores de lectura.
 */
export function parseBatch(text, family) {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.split('\t').map(clean))
    .filter((cells) => cells.some(Boolean))

  const hasHeader = lines.length > 0 && isHeader(lines[0])
  const body = hasHeader ? lines.slice(1) : lines
  const codeRequired = CODE_REQUIRED.includes(family.scheme)

  const rows = body.map((cells, index) => {
    const [descripcion = '', barras = '', ean = '', talleRaw = '', codigoRaw = ''] = cells
    const codigo = codigoRaw.toUpperCase().replace(/\s+/g, '')
    const size = parseSize(talleRaw.toUpperCase(), family)
    const errors = []

    if (cells.length < 4) errors.push('Faltan columnas: se esperan Descripción, Código de barras, EAN y Talle')
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
      line: index + 1 + (hasHeader ? 1 : 0),
      descripcion: descripcion.toUpperCase(),
      barras: onlyDigits(barras),
      ean: onlyDigits(ean),
      size,
      codigo,
      base,
      errors,
    }
  })

  return { rows, hasHeader }
}
