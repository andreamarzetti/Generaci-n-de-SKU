import { ALL_EXISTING_EANS, ALL_EXISTING_SKUS } from '../data/realData'
import { CHECKS, checkDuplicate, checkEan, checkLength } from '../rules/validateRows'
import { brandHasGenericos, decomposeSku } from './engines'

const onlyDigits = (value = '') => String(value).replace(/\D/g, '')

/** Valor de cada segmento: fijo o elegido. */
export function segmentValue(segment, selections) {
  return segment.fixed ?? selections[segment.id] ?? ''
}

/**
 * Arma la propuesta de un motor: un SKU por talle elegido ('' = sin talle).
 * La descripción es manual (A validar): la del artículo, editable por fila.
 */
export function buildEngineProposal(engine, { selections = {}, sizes = [], descripcion = '', rowData = {} } = {}) {
  const missing = engine.segments.filter((segment) => !segmentValue(segment, selections)).map((segment) => segment.label)
  const base = missing.length ? null : engine.segments.map((segment) => segmentValue(segment, selections)).join('')

  const issues = []
  if (missing.length) issues.push(`Falta elegir: ${missing.join(', ')}.`)
  if (sizes.length === 0) issues.push(engine.allowNoSize ? 'Elegí al menos un talle (o "Sin talle").' : 'Elegí al menos un talle.')

  const sizeByCode = new Map(engine.sizes.map((size) => [size.code, size]))
  const rows = sizes.map((code) => {
    const key = code || 'SIN_TALLE'
    const override = rowData[key]?.descripcion
    return {
      key,
      label: code ? code.slice(1) : 'Sin talle',
      size: { code, known: code === '' ? engine.allowNoSize : sizeByCode.has(code) },
      sku: base ? `${base}${code}` : null,
      buildError: base ? null : `Falta elegir: ${missing.join(', ')}`,
      descripcion: (override ?? descripcion).toUpperCase(),
      descripcionEditada: override !== undefined,
    }
  })

  const segments = [
    ...engine.segments.map((segment) => ({
      id: segment.id,
      label: `${segment.label} · ${segment.length}`,
      value: segmentValue(segment, selections),
      size: segment.length,
      variant: segment.fixed ? 'brand' : segment.article ? 'free' : 'code',
    })),
    { id: 'talle', label: 'Talle', value: sizes[0] ?? '', size: 3, variant: 'size' },
  ]

  return { rows, issues, segments, groups: [] }
}

/** Controles de los motores: los mismos que LS2, salvo código de barras y precio (solo LS2). */
export const ENGINE_CHECKS = [
  ...CHECKS.filter((check) => ['length', 'format'].includes(check.id)),
  { id: 'duplicate', label: 'SKU duplicado', description: 'Lote, artículos existentes de todas las marcas y sesión', source: 'Datos reales · mock' },
  { id: 'ean', label: 'EAN', description: 'Opcional; si se carga, 13 dígitos, verificador GS1 y sin repetir', source: 'GS1 + datos reales · mock' },
  { id: 'size', label: 'Talle', description: 'Tabla de talles del motor', source: 'Hojas de referencia' },
  { id: 'generico', label: 'Código genérico', description: 'Obligatorio, filtrado por marca y familia', source: 'Especificación Funcional' },
  { id: 'description', label: 'Descripción', description: 'Manual en esta etapa (a validar)', source: 'Carga del alta' },
  CHECKS.find((check) => check.id === 'synonym'),
]

const ok = (message) => ({ status: 'ok', message })
const warn = (message) => ({ status: 'warn', message })
const error = (message) => ({ status: 'error', message })
const notApplicable = (message) => ({ status: 'na', message })
const pending = (message) => ({ status: 'pending', message })

// El control de LS2 dice "artículos de LS2"; acá se compara contra todas las marcas.
const withBrandNeutralMessage = (check) =>
  check.message === 'Ya existe en los artículos de LS2' ? { ...check, message: 'Ya existe en los artículos reales' } : check

function countBy(values) {
  return values.reduce((acc, value) => {
    if (value) acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {})
}

export function validateEngineRows({
  engine,
  proposal,
  rowData = {},
  generico = null,
  existingSkus = ALL_EXISTING_SKUS,
  existingEans = ALL_EXISTING_EANS,
  session = { skus: [], eans: [] },
}) {
  const sessionSkus = new Set(session.skus)
  const sessionEans = new Set(session.eans)
  const eanOf = (row) => onlyDigits(rowData[row.key]?.ean)
  const skuCounts = countBy(proposal.rows.map((row) => row.sku))
  const eanCounts = countBy(proposal.rows.map(eanOf))
  const hasGenericos = brandHasGenericos(engine)

  return proposal.rows.map((row) => {
    const ean = eanOf(row)
    const checks = {
      length: checkLength(row.sku),
      format: row.sku
        ? decomposeSku(engine, row.sku)
          ? ok('Respeta la estructura')
          : error('No respeta la estructura del motor')
        : error(row.buildError ?? 'No se pudo armar el SKU'),
      duplicate: withBrandNeutralMessage(checkDuplicate(row.sku, { existingSkus, sessionSkus, skuCounts })),
      ean: ean ? checkEan(ean, { existingEans, sessionEans, eanCounts }) : notApplicable('Opcional'),
      size: row.size.known
        ? ok(row.size.code ? row.label : 'Sin talle')
        : error(`"${row.size.code}" no está en la tabla de talles`),
      generico: generico
        ? ok(generico.codigo)
        : hasGenericos
          ? error('Sin código genérico')
          : warn('La marca no tiene genéricos cargados (a validar)'),
      description: row.descripcion ? ok(`${row.descripcion.length} caracteres`) : warn('Sin descripción'),
      synonym: pending('Pendiente de definición'),
    }
    const statuses = Object.values(checks).map((check) => check.status)
    const status = statuses.includes('error') ? 'error' : statuses.includes('warn') ? 'warn' : 'ok'
    return { key: row.key, sku: row.sku, checks, status }
  })
}
