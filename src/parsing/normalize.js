/** Mayúsculas, sin acentos y con espacios simples: "Código de barras" → "CODIGO DE BARRAS". */
export function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/** Encabezado de columna normalizado: además quita puntos ("Cód. de barras" → "COD DE BARRAS"). */
export function normalizeHeader(value = '') {
  return normalizeText(value).replace(/\./g, ' ').replace(/\s+/g, ' ').trim()
}

/** Estados de cada dato interpretado. */
export const STATUS = {
  DETECTED: 'detectado',
  DEDUCED: 'deducido',
  MISSING: 'completar',
  EDITED: 'editado',
}

export const field = (value, status, reason = '') => ({ value: value ?? '', status: value ? status : STATUS.MISSING, reason })
export const missing = (reason = '') => ({ value: '', status: STATUS.MISSING, reason })
