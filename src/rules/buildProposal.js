import { BARCODE_PREFIX_LENGTH, BRAND_PREFIX } from './constants'
import { descriptionWithoutSize, gs1Description, MAX_TANGO_DESCRIPTION, tangoDescription } from './descriptions'
import { assignFreeDigits, freeDigitsExhaustedMessage } from './freeDigits'
import { genericSkus } from './genericSku'
import { normalizeSize, sortBySize, splitFootwearCode, splitSupplierCodes } from './sizes'

const onlyDigits = (value = '') => String(value).replace(/\D/g, '')
const normalizeCode = (value = '') => String(value).toUpperCase().replace(/\s+/g, '')
/** Varios códigos en un mismo campo: cada ";" (o salto de línea) separa uno de otro. */
export const splitCodes = (value = '') => String(value).split(/[;\n]/).map(normalizeCode).filter(Boolean)

/** Clave de fila única aunque el mismo código se repita (el duplicado lo marca la validación). */
function uniqueKeys(codes) {
  const seen = {}
  return codes.map((code) => {
    seen[code] = (seen[code] ?? 0) + 1
    return seen[code] > 1 ? `${code}#${seen[code]}` : code
  })
}

const barcodePrefix = (barcode) => {
  const digits = onlyDigits(barcode)
  return digits.length >= BARCODE_PREFIX_LENGTH ? digits.slice(0, BARCODE_PREFIX_LENGTH) : null
}

/**
 * Arma la propuesta de SKU a partir de la carga uno por uno (`form`) o de la
 * carga masiva (`batchRows`). Es puro: las fuentes de dígitos usados se inyectan.
 *
 * Devuelve:
 *  - segments: bloques que componen el SKU (del primer código), para visualizarlos
 *  - rows:     un SKU por fila (sku = null y buildError si no se pudo armar),
 *              con descripción Tango y GS1
 *  - groups:   (cascos) grupos de 7 dígitos + variante con su par de dígitos libres
 *  - generics: SKU genérico de cada variante (el SKU sin talle) con su descripción
 *  - issues:   datos que faltan para completar la propuesta
 */
export function buildProposal(family, { form = {}, batchRows = null, rowData = {} } = {}, options = {}) {
  const base = batchRows ? buildFromBatch(family, batchRows, rowData) : buildFromForm(family, form, rowData)
  const withSkus = family.scheme === 'cascos' ? composeCascos(base, rowData, options) : base
  const rows = withSkus.rows.map((row) => withDescriptions(row, rowData))
  const generics = genericSkus(rows, (row) => descriptionWithoutSize(row.tango.text, row.size?.recognized ? row.size.value : null))
  return { ...withSkus, rows, generics }
}

// ── Carga manual ──────────────────────────────────────────

/** Filas de cascos (manual): una por talle recibido, sin repetir el mismo talle oficial. */
export function cascoRows(talles = []) {
  const seen = new Set()
  return sortBySize(talles).flatMap((raw) => {
    const size = normalizeSize(raw)
    const key = size.value ?? size.raw
    if (seen.has(key)) return []
    seen.add(key)
    return [{ key, label: size.value ?? size.raw, size }]
  })
}

/** Primeros 7 dígitos del código de barras de la primera fila que lo tenga completo. */
export function cascoPrefix(rows, rowData = {}) {
  for (const row of rows) {
    const prefix = barcodePrefix(rowData[row.key]?.barras)
    if (prefix) return prefix
  }
  return null
}

function buildFromForm(family, form, rowData) {
  const descripcion = form.descripcion ?? ''
  switch (family.scheme) {
    case 'cascos': {
      const rows = cascoRows(form.talles)
      const prefix = cascoPrefix(rows, rowData)
      const issues = []
      if (rows.length === 0) issues.push('Seleccioná al menos un talle.')
      else if (!prefix) issues.push('Cargá el código de barras de cada talle en la tabla: de ahí salen los 7 dígitos.')
      return {
        rows: rows.map((row) => ({ ...row, descripcion, prefix, groupKey: prefix })),
        issues,
      }
    }
    case 'talleSufijo':
    case 'calzado': {
      const lines = splitCodes(form.codigos)
      const parts = family.scheme === 'calzado' ? lines.map(splitFootwearCode) : splitSupplierCodes(lines)
      const keys = uniqueKeys(lines)
      const rows = lines.map((line, index) =>
        supplierRow({ key: keys[index], source: line, descripcion, ...parts[index] }),
      )
      return { rows, issues: lines.length === 0 ? ['Ingresá al menos un código del proveedor.'] : [] }
    }
    default: {
      const codes = splitCodes(form.codigo)
      const keys = uniqueKeys(codes)
      return {
        rows: codes.map((code, index) => singleRow(family, { key: keys[index], code, descripcion })),
        issues: codes.length ? [] : ['Ingresá el código del proveedor.'],
      }
    }
  }
}

// ── Carga masiva ──────────────────────────────────────────

function buildFromBatch(family, batchRows, rowData) {
  const rows = batchRows.map((row) => {
    const parseError = row.errors[0] ?? null
    const common = { key: row.key, line: row.line, descripcion: row.descripcion, parseErrors: row.errors }
    switch (family.scheme) {
      case 'cascos': {
        const prefix = barcodePrefix(rowData[row.key]?.barras)
        const variant = descriptionWithoutSize(row.descripcion, row.size?.value)
        return {
          ...common,
          label: row.size?.value ?? row.size?.raw ?? '?',
          size: row.size,
          prefix,
          variant,
          groupKey: prefix ? `${prefix}|${variant}` : null,
          buildError: parseError,
        }
      }
      case 'talleSufijo':
      case 'calzado':
        return supplierRow({ ...common, source: row.codigo, base: row.base, size: row.size, parseError })
      default:
        return singleRow(family, { ...common, code: row.codigo, parseError })
    }
  })
  return { rows, issues: rows.length === 0 ? ['El lote no tiene filas.'] : [] }
}

// ── Composición ───────────────────────────────────────────

function supplierRow({ key, source, descripcion, base, size, parseError = null, ...rest }) {
  let buildError = parseError
  if (!buildError && !base) buildError = `"${source}" no tiene dígitos para armar el código`
  if (!buildError && !size?.recognized) buildError = `No se detectó el talle al final de "${source}"`
  return {
    ...rest,
    key,
    label: size?.value ?? '?',
    source,
    descripcion,
    size,
    base,
    sku: buildError ? null : `${BRAND_PREFIX}${base}.${size.value}`,
    buildError,
  }
}

function singleRow(family, { key, code, descripcion, parseError = null, ...rest }) {
  const suffix = family.scheme === 'talleUnico' ? '.TU' : ''
  const buildError = parseError ?? (code ? null : 'Falta el código del proveedor')
  return {
    ...rest,
    key,
    label: suffix ? 'TU' : '—',
    source: code,
    descripcion,
    size: suffix ? { raw: 'TU', value: 'TU', normalized: false, recognized: true } : null,
    sku: buildError ? null : `${BRAND_PREFIX}${code}${suffix}`,
    buildError,
  }
}

/** Cascos: agrupa por 7 dígitos + variante y asigna un par de dígitos libres por grupo. */
function composeCascos({ rows, issues }, rowData, { freeDigitSources, freeDigitChoices } = {}) {
  const groupMap = new Map()
  rows.forEach((row) => {
    if (!row.groupKey || groupMap.has(row.groupKey)) return
    groupMap.set(row.groupKey, { key: row.groupKey, prefix: row.prefix, variant: row.variant ?? row.descripcion ?? '' })
  })
  const groups = assignFreeDigits([...groupMap.values()], { sources: freeDigitSources, choices: freeDigitChoices })
  const groupByKey = new Map(groups.map((group) => [group.key, group]))

  const exhaustedIssues = groups.filter((group) => group.exhausted).map((group) => freeDigitsExhaustedMessage(group.prefix))

  const composed = rows.map((row) => {
    const group = groupByKey.get(row.groupKey)
    let buildError = row.buildError ?? null
    if (!buildError && !row.size?.recognized) buildError = `Talle "${row.size?.raw ?? ''}" fuera de la tabla oficial`
    if (!buildError && !group) buildError = 'Falta el código de barras (mínimo 7 dígitos)'
    if (!buildError && !group.freeDigit) buildError = freeDigitsExhaustedMessage(group.prefix)
    return {
      ...row,
      groupSize: group ? rows.filter((other) => other.groupKey === group.key).length : 0,
      sku: buildError ? null : `${BRAND_PREFIX}${group.prefix}${group.freeDigit}.${row.size.value}`,
      buildError,
    }
  })

  return { rows: composed, issues: [...issues, ...new Set(exhaustedIssues)], groups }
}

// ── Descripciones ─────────────────────────────────────────

function withDescriptions(row, rowData) {
  const sizeValue = row.size?.recognized ? row.size.value : null
  const auto = tangoDescription(row.descripcion ?? '', sizeValue)
  const override = rowData[row.key]?.descTango
  const text = override !== undefined ? override.toUpperCase() : auto.text
  return {
    ...row,
    tango: { ...auto, text, length: text.length, overLimit: text.length > MAX_TANGO_DESCRIPTION, edited: override !== undefined, autoText: auto.text },
    gs1: gs1Description(text, sizeValue),
  }
}

/** Segmentos del SKU de una fila para mostrar su composición (por defecto, la primera). */
export function proposalSegments(family, proposal, first = proposal.rows[0]) {
  const size = first?.size?.recognized ? `.${first.size.value}` : ''
  if (family.scheme === 'cascos') {
    const group = proposal.groups?.find((item) => item.key === first?.groupKey)
    return [
      { id: 'marca', label: 'Prefijo', value: BRAND_PREFIX, variant: 'brand' },
      { id: 'barras', label: 'Cód. barras · 7', value: group?.prefix ?? '', size: 7, variant: 'code' },
      { id: 'libres', label: 'Libres · 2', value: group?.freeDigit ?? '', size: 2, variant: 'free', pending: true },
      { id: 'talle', label: 'Talle', value: size, size: 3, variant: 'size' },
    ]
  }
  if (family.scheme === 'talleSufijo' || family.scheme === 'calzado') {
    return [
      { id: 'marca', label: 'Prefijo', value: BRAND_PREFIX, variant: 'brand' },
      { id: 'codigo', label: 'Cód. proveedor sin letras', value: first?.base ?? '', size: 9, variant: 'code' },
      { id: 'talle', label: 'Talle', value: size, size: 3, variant: 'size' },
    ]
  }
  const segments = [
    { id: 'marca', label: 'Prefijo', value: BRAND_PREFIX, variant: 'brand' },
    { id: 'codigo', label: 'Cód. proveedor', value: first?.source ?? '', size: 8, variant: 'code' },
  ]
  if (family.scheme === 'talleUnico') segments.push({ id: 'sufijo', label: 'Talle único', value: '.TU', variant: 'size' })
  return segments
}
