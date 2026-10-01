// Excel de "Altas de referencia": un archivo aparte, sin tocar CODIFICACION 2023. Cada hoja trae
// solo las filas nuevas, con las columnas de la tabla de origen, listas para pegar donde corresponde.
import { ALTA_STATUS, getAlta } from './store'
import { getTarget, tableColumns } from './targets'

const PLANTILLAS = { cascos: 'Cascos', producto: 'Producto', ambos: 'Cascos y producto' }
const STATUS_LABEL = { [ALTA_STATUS.PENDING]: 'Pendiente de aceptar', [ALTA_STATUS.ACCEPTED]: 'Aceptada' }

const day = (iso) => String(iso ?? '').slice(0, 10)
const trailing = (entry) => [STATUS_LABEL[entry.status] ?? entry.status, day(entry.createdAt), entry.createdBy ?? '']
const TRAILING_HEADERS = ['Estado', 'Creada', 'Usuario']

/** Hojas por tipo de alta: encabezados y cómo sale cada fila. */
const KIND_SHEETS = [
  {
    kind: 'marca',
    name: 'Marcas',
    headers: ['Código', 'Nombre', 'Cómo se arma el SKU'],
    row: ({ values }) => [values.codigo, values.descripcion, PLANTILLAS[values.plantilla] ?? values.plantilla],
  },
  {
    kind: 'calota',
    name: 'Calotas',
    headers: ['Hoja de CODIFICACION 2023', 'Marca', 'Código', 'Descripción'],
    row: ({ values }, target) => [target.sheet, target.label, values.codigo, values.descripcion],
  },
  {
    kind: 'grafica',
    name: 'Graficas',
    headers: ['Hoja de CODIFICACION 2023', 'Ámbito', 'Código', 'Descripción'],
    row: ({ values }, target) => [target.sheet, target.label, values.codigo, values.descripcion],
  },
  {
    kind: 'color',
    name: 'Colores',
    headers: ['Hoja de CODIFICACION 2023', 'Ámbito', 'Código', 'Descripción / color en inglés', 'Abreviatura', 'Español'],
    row: ({ values }, target) => [
      target.sheet,
      target.label,
      values.codigo ?? '',
      values.descripcion ?? values.ingles,
      values.abreviatura ?? '',
      values.espanol ?? '',
    ],
  },
  {
    kind: 'tipologia',
    name: 'Tipologias',
    headers: ['Hoja de CODIFICACION 2023', 'Ámbito', 'Familia', 'Código', 'Descripción', 'Tipo'],
    row: ({ values }, target) => [target.sheet, target.label, values.familia ?? '', values.codigo, values.descripcion, values.tipo ?? ''],
  },
  {
    kind: 'articulo',
    name: 'Articulos',
    headers: ['Hoja de CODIFICACION 2023', 'Ámbito', 'Línea', 'Código', 'Descripción'],
    row: ({ values }, target) => [target.sheet, target.label, values.linea ?? '', values.codigo, values.descripcion],
  },
  {
    kind: 'familia',
    name: 'Familias',
    headers: ['Hoja de CODIFICACION 2023', 'Código', 'Descripción'],
    row: ({ values }, target) => [target.sheet, values.codigo, values.descripcion],
  },
  {
    kind: 'genero',
    name: 'Generos',
    headers: ['Hoja de CODIFICACION 2023', 'Código', 'Descripción', 'Abreviatura'],
    row: ({ values }, target) => [target.sheet, values.codigo, values.descripcion, values.abreviatura ?? ''],
  },
  {
    kind: 'origen',
    name: 'Origenes',
    headers: ['Hoja de CODIFICACION 2023', 'Código', 'Descripción'],
    row: ({ values }, target) => [target.sheet, values.codigo, values.descripcion],
  },
  {
    kind: 'generico',
    name: 'Genericos',
    headers: ['Código', 'Marca', 'Familia', 'Tipología', 'Modelo', 'Género', 'Descripción'],
    row: ({ values }) => [values.codigo, values.marca, values.familia, values.tipologia, values.modelo, values.genero ?? '', values.descripcion],
  },
]

const SUMMARY_HEADERS = ['Tipo', 'Ámbito', 'Código', 'Nombre', 'Hoja de CODIFICACION 2023', ...TRAILING_HEADERS]

/** Hojas del archivo: un resumen con todo y una hoja por cada tipo de alta que haya. */
export function altasSheets(entries) {
  const resolved = entries.map((entry) => ({ entry, target: getTarget(entry.target) })).filter((item) => item.target)

  const summary = {
    name: 'Resumen',
    headers: SUMMARY_HEADERS,
    rows: resolved.map(({ entry, target }) => [
      target.kindLabel ?? target.kind,
      target.label,
      entry.values.codigo ?? '',
      entry.values.descripcion ?? entry.values.ingles ?? '',
      target.sheet,
      ...trailing(entry),
    ]),
  }

  const bySheet = KIND_SHEETS.map((config) => ({
    name: config.name,
    headers: [...config.headers, ...TRAILING_HEADERS],
    rows: resolved.filter(({ target }) => target.kind === config.kind).map(({ entry, target }) => [...config.row(entry, target), ...trailing(entry)]),
  })).filter((sheet) => sheet.rows.length > 0)

  return [summary, ...bySheet]
}

/** Hoja con una tabla completa (lo que ya existe y las altas), con la columna Estado al principio. */
export function tableSheet(target, records) {
  const columns = tableColumns(target)
  const show = (field, values) => (field.name === 'plantilla' ? (PLANTILLAS[values[field.name]] ?? values[field.name] ?? '') : (values[field.name] ?? ''))
  return {
    name: `${target.kindLabel} ${target.label}`.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31),
    headers: ['Estado', ...columns.map((field) => field.label)],
    rows: records.map(({ alta, values }) => [
      alta ? (STATUS_LABEL[getAlta(alta)?.status] ?? 'Nueva') : 'Existente',
      ...columns.map((field) => show(field, values)),
    ]),
  }
}

export const tableFileName = (target, date = new Date()) => `Tabla ${target.kindLabel} - ${target.label} - ${date.toISOString().slice(0, 10)}.xlsx`

/** "Altas de referencia - 2026-09-30.xlsx": se entiende solo y no pisa a CODIFICACION 2023. */
export const altasFileName = (date = new Date()) => `Altas de referencia - ${date.toISOString().slice(0, 10)}.xlsx`

/** Descarga hojas como .xlsx. La librería se carga solo al usarla. */
export async function downloadSheets(sheetList, fileName) {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const sheets = sheetList.map((sheet) => ({
    sheet: sheet.name,
    stickyRowsCount: 1,
    columns: sheet.headers.map((header) => ({ width: Math.max(14, Math.min(header.length + 6, 40)) })),
    data: [
      sheet.headers.map((value) => ({ value, fontWeight: 'bold' })),
      ...sheet.rows.map((row) => row.map((value) => ({ value: String(value ?? ''), type: String }))),
    ],
  }))
  await writeExcelFile(sheets).toFile(fileName)
}

export const downloadAltas = (entries, fileName = altasFileName()) => downloadSheets(altasSheets(entries), fileName)
export const downloadTable = (target, records, fileName = tableFileName(target)) => downloadSheets([tableSheet(target, records)], fileName)
