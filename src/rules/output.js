import { RULE_STATUS, SOURCES } from './constants'

const { CONFIRMED, PENDING } = RULE_STATUS

/** Datos fijos del alta de un SKU de LS2 en Tango. Solo se muestran; no se envían. */
export const ALTA_DATA = [
  {
    id: 'tipo',
    label: 'Tipo de SKU',
    value: 'SKU importado (SKU_IMPO)',
    status: PENDING,
    source: SOURCES.IMPORTED,
    note: 'Pendiente: si todos los artículos LS2 son importados.',
  },
  {
    id: 'cuenta',
    label: 'Cuenta',
    value: '11505 – Mercaderías para SKU de venta',
    status: CONFIRMED,
    source: SOURCES.ACCOUNT,
  },
  {
    id: 'proveedores',
    label: 'Proveedores',
    value: 'H00850 (importación) · Z00001 (interno, Servicompras)',
    status: CONFIRMED,
    source: SOURCES.STEP_16_MEETING,
    note: 'H00850 es obligatorio para generar las carpetas de importación.',
  },
]

/** Estructura del archivo de alta para Tango (resumen; la plantilla oficial está pendiente). */
export const TANGO_FILE = {
  sheets: ['Artículos', 'Unidades de compra', 'Precios', 'Proveedores'],
  priceLists: 11,
  suppliers: ['H00850', 'Z00001'],
}

export const CLASSIFICATION_RULE = {
  text: 'Clasificación IMPORTADO › LS2 › Familia › Tipología › Modelo. En cascos, "código + modelo" (FF800 STORM).',
  status: PENDING,
  source: SOURCES.TANGO_TREE,
}
