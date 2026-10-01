import { ALL_EXISTING_EANS, ALL_EXISTING_SKUS } from '../data/realData'
import { checkGenericExists, genericSkuOf, genericSkus } from '../rules/genericSku'
import { effectiveSizes, planRowKey } from '../rules/variantPlan'
import { CHECKS, checkDuplicate, checkEan, checkLength } from '../rules/validateRows'
import { BRANDS, brandHasGenericos, decomposeSku } from './engines'

const onlyDigits = (value = '') => String(value).replace(/\D/g, '')

/**
 * Qué significa el código de un segmento (para el mensaje al pasar el mouse): "10" → Tipología: FF SV.
 * `text` es null si el código no tiene descripción en la tabla; `alta` marca los datos nuevos.
 */
function segmentDetail(engine, segment, selections, value) {
  if (!value) return null
  if (segment.fixed) return { title: segment.label, text: BRANDS.find((brand) => brand.id === engine.brand)?.label ?? value }
  const options = segment.article ? segment.lines.flatMap((line) => line.items) : segment.getOptions(selections)
  const option = options.find((item) => item.code === value)
  return { title: segment.label, text: option?.label ?? null, alta: option?.alta }
}

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
      detail: segmentDetail(engine, segment, selections, segmentValue(segment, selections)),
    })),
    { id: 'talle', label: 'Talle', value: sizes[0] ?? '', size: 3, variant: 'size', detail: sizes[0] ? { title: 'Talle', text: sizes[0].slice(1), plain: true } : null },
  ]

  // El genérico es el SKU sin talle; su descripción es la del artículo (sin talle).
  const generics = genericSkus(rows, () => descripcion.toUpperCase())
  return { rows, issues, segments, groups: [], generics }
}

/** El segmento de talle de una fila: su valor y su detalle. */
const withSize = (segment, row) => ({
  ...segment,
  value: row.size.code,
  detail: row.size.code ? { title: 'Talle', text: row.label, plain: true } : null,
})

/**
 * Propuesta de varias variantes juntas (carga masiva): cada variante tiene sus propios segmentos y talles
 * (los suyos o la curva de todas). Las filas llevan la clave "variante|talle" y su variante.
 * @param variants [{ key, descripcion, selections, sizes: string[] | null }]
 * @param curve    talles de las variantes que no tienen los suyos
 */
export function buildBatchProposal(engine, { variants = [], curve = [], rowData = {} } = {}) {
  const parts = variants.map((variant) => {
    const sizes = effectiveSizes(variant, curve)
    // La descripción editada de una fila se guarda con la clave completa; el armado por variante la espera por talle.
    const scoped = Object.fromEntries(
      sizes.flatMap((code) => {
        const data = rowData[planRowKey(variant.key, code)]
        return data ? [[code || 'SIN_TALLE', data]] : []
      }),
    )
    return { variant, proposal: buildEngineProposal(engine, { selections: variant.selections, sizes, descripcion: variant.descripcion, rowData: scoped }) }
  })

  const rows = parts.flatMap(({ variant, proposal }) =>
    proposal.rows.map((row) => ({
      ...row,
      key: planRowKey(variant.key, row.size.code),
      variantKey: variant.key,
      variant: variant.descripcion,
      segments: proposal.segments.map((segment) => (segment.id === 'talle' ? withSize(segment, row) : segment)),
    })),
  )
  const generics = [...new Map(parts.flatMap(({ proposal }) => proposal.generics).map((item) => [item.sku, item])).values()]
  const issues = variants.length === 0 ? ['No hay variantes para cargar.'] : parts.flatMap(({ variant, proposal }) => proposal.issues.map((issue) => `${variant.descripcion}: ${issue}`))

  return { rows, issues, segments: parts[0]?.proposal.segments ?? buildEngineProposal(engine).segments, groups: [], generics, batch: true }
}

/** Controles de los motores: los mismos que LS2, salvo código de barras y precio (solo LS2). */
export const ENGINE_CHECKS = [
  ...CHECKS.filter((check) => ['length', 'format'].includes(check.id)),
  { id: 'duplicate', label: 'SKU duplicado', description: 'Lote, artículos existentes de todas las marcas y sesión', source: 'Datos reales · mock' },
  { id: 'ean', label: 'EAN', description: 'Opcional; si se carga, 13 dígitos, verificador GS1 y sin repetir', source: 'GS1 + datos reales · mock' },
  { id: 'size', label: 'Talle', description: 'Tabla de talles del motor', source: 'Hojas de referencia' },
  { id: 'generico', label: 'Código genérico', description: 'El SKU genérico (el mismo SKU sin talle) agrupa la curva; sin curva se elige de la lista', source: 'Especificación Funcional' },
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

/** Si el SKU está libre pero su genérico ya existe, se avisa (el genérico se reutiliza). */
const withGenericWarning = (check, sku, sources) => (check.status === 'ok' ? (checkGenericExists(sku, sources) ?? check) : check)

function countBy(values) {
  return values.reduce((acc, value) => {
    if (value) acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {})
}

/** Segmentos de cada SKU (uno por talle), para la tabla de composición. */
export function engineRowSegments(proposal) {
  return proposal.rows.map((row) => ({
    row,
    // En la carga masiva cada variante trae sus propios segmentos.
    segments: row.segments ?? proposal.segments.map((segment) => (segment.id === 'talle' ? withSize(segment, row) : segment)),
  }))
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
      duplicate: withGenericWarning(checkDuplicate(row.sku, { existingSkus, sessionSkus, skuCounts }), row.sku, { existingSkus, sessionSkus }),
      ean: ean ? checkEan(ean, { existingEans, sessionEans, eanCounts }) : notApplicable('Opcional'),
      size: row.size.known
        ? ok(row.size.code ? row.label : 'Sin talle')
        : error(`"${row.size.code}" no está en la tabla de talles`),
      // Con curva de talles, el genérico es el propio SKU sin talle; sin curva, se elige de la lista.
      generico: genericSkuOf(row.sku)
        ? ok(`SKU genérico ${genericSkuOf(row.sku)}`)
        : generico
          ? ok(generico.codigo)
          : hasGenericos
            ? error('Sin código genérico')
            : warn('La marca no tiene genéricos cargados (a validar)'),
      description: row.descripcion ? ok(`${row.descripcion.length} caracteres`) : warn('Sin descripción'),
      synonym: pending('Pendiente de definición'),
    }
    // Una fila que se omite no se crea: lo demás (EAN, descripción…) ya no la puede bloquear.
    const omit = checks.duplicate.omit === true
    const statuses = Object.values(checks).map((check) => check.status)
    const status = omit ? 'warn' : statuses.includes('error') ? 'error' : statuses.includes('warn') ? 'warn' : 'ok'
    return { key: row.key, sku: row.sku, checks, status, omit }
  })
}
