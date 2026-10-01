// Salida del lote confirmado: resumen para copiar (como el mail de cierre de Andrés)
// y descarga .xlsx. El formato de importación a Tango se ajusta con la plantilla oficial.

export const DUN_PENDING = 'Pendiente (GS1)'

export const SUMMARY_COLUMNS = ['SKU', 'Descripción Tango', 'EAN', 'Código genérico', 'DUN']
export const XLSX_COLUMNS = ['SKU', 'Descripción', 'EAN', 'Código genérico', 'Talle', 'Precio', 'Clasificación']

export function summaryRows(items) {
  return items.map((item) => [item.sku, item.descTango, item.ean, item.generico ?? '', DUN_PENDING])
}

/** Resumen separado por tabulaciones: se pega directo en Excel o en un mail. */
export function summaryTsv(items) {
  return [SUMMARY_COLUMNS, ...summaryRows(items)].map((row) => row.join('\t')).join('\n')
}

export function xlsxRows(items) {
  return items.map((item) => [item.sku, item.descTango, item.ean, item.generico ?? '', item.talle ?? '', item.precio ?? '', item.clasificacion ?? ''])
}

/** Descarga el lote como .xlsx con una hoja "Artículos". La librería se carga solo al usarla. */
export async function downloadXlsx(items, fileName) {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const header = XLSX_COLUMNS.map((value) => ({ value, fontWeight: 'bold' }))
  const body = xlsxRows(items).map((row) => row.map((value) => ({ value: String(value), type: String })))
  await writeExcelFile([header, ...body], {
    sheet: 'Artículos',
    columns: [{ width: 18 }, { width: 34 }, { width: 16 }, { width: 18 }, { width: 8 }, { width: 10 }, { width: 18 }],
  }).toFile(fileName)
}
