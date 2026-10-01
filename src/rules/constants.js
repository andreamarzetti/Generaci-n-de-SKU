export const MAX_SKU_LENGTH = 15
export const MIN_SKU_LENGTH = 8
export const BRAND_PREFIX = 'LS2'
export const EAN_LENGTH = 13
export const BARCODE_PREFIX_LENGTH = 7

/**
 * Dígitos libres de los cascos de LS2, en el orden en que se asignan:
 * 01–99, luego A1…A9, A0, B1…B0 … Z1…Z0 y por último 1A…9A, 0A, 1B…0B … 1Z…0Z.
 */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const DIGITS_FROM_ONE = '1234567890'.split('')
export const FREE_DIGIT_RANGE = [
  ...Array.from({ length: 99 }, (_, index) => String(index + 1).padStart(2, '0')),
  ...LETTERS.flatMap((letter) => DIGITS_FROM_ONE.map((digit) => letter + digit)),
  ...LETTERS.flatMap((letter) => DIGITS_FROM_ONE.map((digit) => digit + letter)),
]

export const RULE_STATUS = {
  CONFIRMED: 'confirmada',
  PENDING: 'pendiente',
  UNDEFINED: 'sin-definir',
}

/** Fuentes citadas en las reglas. */
export const SOURCES = {
  TANGO: 'Límite de Tango',
  PROCESS_DOCS: 'Documentación del proceso',
  MEETING_18_09: 'Reunión del 18/09',
  STEP_BY_STEP_21_09: 'Paso a paso del 21/09',
  FUNCTIONAL_SPEC: 'Especificación Funcional, campo 116',
  SIZE_TABLE: 'Tabla oficial de talles (CODIFICACION 2023)',
  GS1: 'Estándar GS1',
  REAL_DATA: 'Datos reales (CODIFICACION 2023)',
  AREA_RULE_MERCH: 'Regla conocida del área + dato real de Merch',
  AREA_RULE: 'Regla conocida del área',
  COLOR_TABLE: 'Tabla de colores (CODIFICACION 2023) + paso a paso del 21/09',
  STEP_16_MEETING: 'Paso a paso del proceso (paso 16) y reunión del 18/09',
  ACCOUNT: 'Especificación Funcional, campo 125, y paso a paso (parametrización contable)',
  IMPORTED: 'Datos reales (Origen IMPORTADO en el ejemplo del 21/09) y Especificación Funcional (tipología SKU_IMPO)',
  HISTORIC_EXCEL: 'Excel histórico (columna "SKU LS2"); no figura en lo que envía LS2 según el paso a paso del 21/09',
  TANGO_TREE: 'Árbol real de Tango (Importado → Urbax → Cascos → Integral → FF313 AVA)',
}
