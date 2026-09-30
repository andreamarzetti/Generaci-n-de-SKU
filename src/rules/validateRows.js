import { EXISTING_EANS, EXISTING_SKUS } from '../data/realData'
import { isValidGtin } from '../utils/gtin'
import { BARCODE_PREFIX_LENGTH, EAN_LENGTH, MAX_SKU_LENGTH, MIN_SKU_LENGTH } from './constants'
import { MAX_TANGO_DESCRIPTION } from './descriptions'

export const CHECKS = [
  { id: 'length', label: 'Longitud', description: `Máximo ${MAX_SKU_LENGTH}; recomendado desde ${MIN_SKU_LENGTH}`, source: 'Límite de Tango' },
  { id: 'format', label: 'Formato', description: 'Estructura de la familia', source: 'Reglas de familia' },
  { id: 'duplicate', label: 'SKU duplicado', description: 'Lote, artículos existentes y sesión', source: 'Datos reales · mock' },
  { id: 'ean', label: 'EAN', description: '13 dígitos, verificador GS1 y sin repetir', source: 'GS1 + datos reales · mock' },
  { id: 'barcode', label: 'Código de barras', description: 'Mínimo 7 dígitos; en cascos, mismo prefijo', source: 'Paso a paso del 21/09' },
  { id: 'size', label: 'Talle', description: 'Tabla oficial de talles', source: 'Tabla oficial de talles' },
  { id: 'generico', label: 'Código genérico', description: 'Obligatorio para todo SKU', source: 'Especificación Funcional' },
  { id: 'description', label: 'Descripción Tango', description: 'Hasta 30 caracteres (a validar)', source: 'Datos reales' },
  { id: 'price', label: 'Precio', description: 'Opcional por talle', source: 'Carga del alta' },
  { id: 'synonym', label: 'Sinónimo', description: 'Campo de Tango sin regla definida', source: 'Pendiente de definición' },
]

const ok = (message) => ({ status: 'ok', message })
const warn = (message) => ({ status: 'warn', message })
const error = (message) => ({ status: 'error', message })
const notApplicable = (message = 'No aplica') => ({ status: 'na', message })
const pending = (message) => ({ status: 'pending', message })

const onlyDigits = (value = '') => String(value).replace(/\D/g, '')

function countBy(values) {
  return values.reduce((acc, value) => {
    if (value) acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {})
}

/**
 * Ejecuta todos los controles sobre las filas de la propuesta. Es puro:
 * la fuente de artículos existentes y lo confirmado en la sesión se inyectan.
 */
export function validateRows({
  family,
  proposal,
  rowData = {},
  generico = null,
  existingSkus = EXISTING_SKUS,
  existingEans = EXISTING_EANS,
  session = { skus: [], eans: [] },
}) {
  const sessionSkus = new Set(session.skus)
  const sessionEans = new Set(session.eans)
  const eanOf = (row) => onlyDigits(rowData[row.key]?.ean)
  const skuCounts = countBy(proposal.rows.map((row) => row.sku))
  const eanCounts = countBy(proposal.rows.map(eanOf))

  return proposal.rows.map((row) => {
    const data = rowData[row.key] ?? {}
    const checks = {
      length: checkLength(row.sku),
      format: checkFormat(row, family),
      duplicate: checkDuplicate(row.sku, { existingSkus, sessionSkus, skuCounts }),
      ean: checkEan(eanOf(row), { existingEans, sessionEans, eanCounts }),
      barcode: checkBarcode(onlyDigits(data.barras), family, row.prefix),
      size: checkSize(row.size, family),
      generico: generico ? ok(generico.codigo) : error('Sin código genérico'),
      description: checkDescription(row.tango),
      price: String(data.precio ?? '').trim() ? ok('Informado') : warn('Sin precio'),
      synonym: pending('Pendiente de definición'),
    }

    const statuses = Object.values(checks).map((check) => check.status)
    const status = statuses.includes('error') ? 'error' : statuses.includes('warn') ? 'warn' : 'ok'
    return { key: row.key, sku: row.sku, checks, status }
  })
}

export function checkLength(sku) {
  if (!sku) return notApplicable('Sin SKU armado')
  if (sku.length > MAX_SKU_LENGTH) return error(`${sku.length} caracteres · excede ${MAX_SKU_LENGTH}`)
  if (sku.length < MIN_SKU_LENGTH) return warn(`${sku.length} caracteres · menos de ${MIN_SKU_LENGTH} (recomendado)`)
  return ok(`${sku.length} caracteres`)
}

function checkFormat(row, family) {
  if (!row.sku) return error(row.buildError ?? 'No se pudo armar el SKU')
  return family.formatPattern.test(row.sku) ? ok('Formato válido') : error(`Se espera ${family.formatHint}`)
}

export function checkDuplicate(sku, { existingSkus, sessionSkus, skuCounts }) {
  if (!sku) return notApplicable('Sin SKU armado')
  if (existingSkus.has(sku)) return error('Ya existe en los artículos de LS2')
  if (sessionSkus.has(sku)) return error('Ya confirmado en esta sesión')
  if (skuCounts[sku] > 1) return error('Repetido dentro del lote')
  return ok('Sin duplicados')
}

export function checkEan(ean, { existingEans = EXISTING_EANS, sessionEans = new Set(), eanCounts = {} } = {}) {
  if (!ean) return error('Sin EAN')
  if (ean.length !== EAN_LENGTH) return error(`Tiene ${ean.length} dígitos; debe tener ${EAN_LENGTH}`)
  if (!isValidGtin(ean)) return error('Dígito verificador inválido')
  if (existingEans.has(ean)) return error(`Duplicado: ya asignado a ${existingEans.get(ean)}`)
  if (sessionEans.has(ean)) return error('Duplicado: ya confirmado en esta sesión')
  if (eanCounts[ean] > 1) return error('Duplicado dentro del lote')
  return ok('EAN válido')
}

export function checkBarcode(barcode, family, prefix) {
  const isCasco = family.scheme === 'cascos'
  if (!barcode) return isCasco ? error('Sin código de barras') : notApplicable('Opcional')
  if (barcode.length < BARCODE_PREFIX_LENGTH) {
    return error(`Tiene ${barcode.length} dígitos; mínimo ${BARCODE_PREFIX_LENGTH}`)
  }
  const own = barcode.slice(0, BARCODE_PREFIX_LENGTH)
  if (isCasco && prefix && own !== prefix) {
    return error(`Empieza con ${own}; el resto de los talles con ${prefix}`)
  }
  return ok(isCasco ? `Prefijo ${own}` : 'Informado')
}

/** Límite de 30 A validar: los datos históricos no lo superan, pero el ejemplo del 21/09 tiene 34. */
export function checkDescription(tango) {
  if (!tango?.text) return warn('Sin descripción')
  if (tango.overLimit) return warn(`${tango.length} caracteres · supera ${MAX_TANGO_DESCRIPTION} (a validar)`)
  return ok(`${tango.length} caracteres`)
}

function checkSize(size, family) {
  if (!family.hasSize || !size) return notApplicable()
  if (!size.recognized) return error(size.raw ? `"${size.raw}" no está en la tabla oficial` : 'No se detectó el talle')
  if (size.normalized) return warn(`Recibido ${size.raw} · normalizado a ${size.value}`)
  return ok(size.value)
}
