import { normalizeHeader, normalizeText } from './normalize'

/** Encabezados reconocidos (ya normalizados: mayúsculas, sin acentos ni puntos). */
const HEADER_PATTERNS = [
  ['variante', /^MODELO VARIANTE$/],
  ['marca', /^MARCA?$/],
  ['familia', /^FAMILIA$/],
  ['tipologia', /^TIPOLOGIA$/],
  ['modelo', /^MODELO$/],
  ['descripcion', /^DESCRIPCION$/],
  ['barras', /^((COD|CODIGO) (DE )?)?BARRAS$/],
  ['ean', /^EAN( ?LS2| ?13)?$/],
  ['talle', /^TALLES?$/],
  ['sku', /^(SKU( LS2)?|(COD|CODIGO) (DE(L)? )?PROVEEDOR)$/],
]

export function headerField(header) {
  const normalized = normalizeHeader(header)
  return HEADER_PATTERNS.find(([, pattern]) => pattern.test(normalized))?.[0] ?? null
}

/**
 * Busca filas pegadas de Excel (separadas por tabulación) con un encabezado reconocible.
 * Devuelve las filas como objetos por campo y las líneas que no forman parte de la tabla.
 */
export function extractTable(text) {
  const lines = String(text ?? '').split(/\r?\n/)
  const headerIndex = lines.findIndex((line) => {
    if (!line.includes('\t')) return false
    return line.split('\t').filter((cell) => headerField(cell)).length >= 2
  })
  if (headerIndex === -1) return { rows: [], columns: [], otherLines: lines }

  const columns = lines[headerIndex].split('\t').map(headerField)
  const rows = []
  const tableLines = new Set([headerIndex])
  for (let index = headerIndex + 1; index < lines.length; index++) {
    const line = lines[index]
    if (!line.includes('\t')) break
    tableLines.add(index)
    const cells = line.split('\t').map((cell) => cell.trim())
    if (!cells.some(Boolean)) continue
    const row = {}
    columns.forEach((column, position) => {
      if (column && cells[position]) row[column] = normalizeText(cells[position])
    })
    rows.push(row)
  }

  return {
    rows,
    columns: columns.filter(Boolean),
    otherLines: lines.filter((_, index) => !tableLines.has(index)),
  }
}
