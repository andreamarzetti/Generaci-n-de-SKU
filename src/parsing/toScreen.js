// Adaptador entre la interpretación y la pantalla: traduce los datos (ya revisados
// por el usuario) al estado de LS2 o del motor de la marca. No completa nada que
// no venga de la interpretación.
import { ALL_GENERICOS, GENERICOS, OFFICIAL_SIZES, REGLA_PRODUCTO } from '../data/realData'
import { BRANDS } from '../engines/engines'
import { FAMILY_LIST } from '../rules/families'
import { variantsFromDescriptions } from '../rules/variantPlan'
import { applyChoices, choicesFor, decomposeDescription, REQUIRED_PARTS, selectionsFromParts, supportsDescription } from './components'

/** Línea del motor según la familia (MAC y GUD tienen cascos y producto). */
function lineFor(brand, familia) {
  if (!brand.lines || brand.lines.length === 1) return brand.lines?.[0] ?? null
  if (!familia) return null
  const isHelmetLine = familia === 'CASCOS' || (brand.id === 'MAC' && familia === 'REPUESTOS')
  return brand.lines.find((line) => line.id === (isHelmetLine ? 'cascos' : 'producto')) ?? null
}

/** Clave del genérico en la pantalla, solo si el código identifica a uno solo. */
function genericKey(list, codigo) {
  const matches = list.filter((generico) => generico.codigo === codigo)
  return matches.length === 1 ? matches[0].key : ''
}

/**
 * Varias variantes marcadas: se cargan juntas en la carga masiva, con una curva de talles para todas
 * (después se pueden cambiar los talles de una variante en particular).
 */
function toMultiLoad(draft, brand, selected) {
  const { familia, generico } = draft.fields
  const curveValues = draft.curve ?? draft.rows.map((row) => row.talle.value).filter(Boolean)
  const variants = variantsFromDescriptions(selected)

  if (brand.id === 'LS2') {
    if (familia.value !== 'CASCOS')
      return { ok: false, reason: 'En LS2, varias variantes juntas se cargan solo para cascos. Marcá una por vez para otras familias.' }
    const curve = OFFICIAL_SIZES.filter((size) => size !== 'TU' && curveValues.includes(size))
    const form = { descripcion: '', generico: generico.value ? genericKey(GENERICOS, generico.value) : '' }
    return {
      ok: true,
      brandId: 'LS2',
      lineId: null,
      target: 'ls2',
      payload: { familyId: 'cascos', form, rowData: {}, plan: { variants, curve } },
    }
  }

  const line = lineFor(brand, familia.value)
  if (!line) return { ok: false, reason: `Completá la familia para elegir la línea de ${brand.label}.` }
  if (line.id !== 'cascos' || !supportsDescription(brand.id)) {
    return { ok: false, reason: `Para ${brand.label} todavía no se pueden cargar varias variantes juntas: marcá una por vez.` }
  }

  // Cada variante tiene que tener sus cuatro partes resueltas (existentes, deducidas o elegidas).
  const resolved = []
  for (const variant of variants) {
    const parts = applyChoices(decomposeDescription(brand.id, variant.descripcion).parts, choicesFor(draft, variant.descripcion))
    const selections = selectionsFromParts(parts)
    const pending = REQUIRED_PARTS.filter((id) => !selections[id])
    if (pending.length) {
      const labels = pending.map((id) => parts.find((part) => part.id === id)?.label ?? id).join(', ')
      return { ok: false, reason: `Falta resolver ${labels.toLowerCase()} en «${variant.descripcion}»: elegí o creá lo que no exista.` }
    }
    resolved.push(selections)
  }

  const engine = line.engine
  const sizeCodes = new Set(engine.sizes.map((size) => size.code))
  const curve = curveValues.map((value) => `.${value}`).filter((code) => sizeCodes.has(code))
  const brandGenericos = ALL_GENERICOS.filter((item) => item.marca === engine.genericBrand)
  return {
    ok: true,
    brandId: brand.id,
    lineId: line.id,
    target: 'engine',
    engineId: engine.id,
    payload: {
      selections: {},
      sizes: [],
      descripcion: '',
      genericoKey: generico.value ? genericKey(brandGenericos, generico.value) : '',
      rowData: {},
      batch: { variants: variants.map((variant, index) => ({ ...variant, selections: resolved[index] })), curve },
    },
  }
}

/**
 * @returns {{ ok: true, brandId, lineId, target, payload } | { ok: false, reason }}
 */
export function toScreenLoad(draft) {
  const { marca, familia, generico, descripcion } = draft.fields
  const brand = BRANDS.find((item) => item.id === marca.value)
  if (!brand) return { ok: false, reason: 'Completá la marca para saber dónde cargar los datos.' }

  if ((draft.selected ?? []).length > 1) return toMultiLoad(draft, brand, draft.selected)

  const rows = draft.rows.filter((row) => row.talle.value)
  const text = descripcion.value ?? ''

  if (brand.id === 'LS2') {
    const family = FAMILY_LIST.find((item) => item.familia === familia.value)
    if (!family) return { ok: false, reason: 'Completá la familia para cargar en LS2.' }
    const form = { descripcion: text, generico: generico.value ? genericKey(GENERICOS, generico.value) : '' }
    let rowData = {}

    if (family.scheme === 'cascos') {
      form.talles = rows.map((row) => row.talleRecibido || row.talle.value)
      rowData = Object.fromEntries(rows.map((row) => [row.talle.value, { barras: row.barras.value, ean: row.ean.value }]))
    } else if (family.scheme === 'talleSufijo' || family.scheme === 'calzado') {
      const withCode = rows.filter((row) => row.codigoProveedor.value)
      form.codigos = withCode.map((row) => row.codigoProveedor.value).join('\n')
      rowData = Object.fromEntries(withCode.map((row) => [row.codigoProveedor.value, { barras: row.barras.value, ean: row.ean.value }]))
    } else {
      const first = draft.rows[0]
      form.codigo = first?.codigoProveedor.value ?? ''
      rowData = first ? { unico: { barras: first.barras.value, ean: first.ean.value } } : {}
    }
    return { ok: true, brandId: 'LS2', lineId: null, target: 'ls2', payload: { familyId: family.id, form, rowData } }
  }

  const line = lineFor(brand, familia.value)
  if (!line) return { ok: false, reason: `Completá la familia para elegir la línea de ${brand.label}.` }

  const engine = line.engine
  const selections = {}
  // La familia de producto tiene código propio en la tabla de referencia (ej. CASCOS = 1).
  if (engine.segments.some((segment) => segment.id === 'familia') && familia.value) {
    const code = REGLA_PRODUCTO.familias.find((item) => item.descripcion === familia.value)?.codigo
    if (code) selections.familia = code
  }
  const sizeCodes = new Set(engine.sizes.map((size) => size.code))
  const sizes = rows.map((row) => `.${row.talle.value}`).filter((code) => sizeCodes.has(code))
  const brandGenericos = ALL_GENERICOS.filter((item) => item.marca === engine.genericBrand)
  // Cascos: la descripción se descompone en tipología, calota, gráfica y color, y se cargan los que existen.
  if (line.id === 'cascos' && supportsDescription(brand.id) && text) {
    Object.assign(selections, selectionsFromParts(applyChoices(decomposeDescription(brand.id, text).parts, choicesFor(draft, text))))
  }

  return {
    ok: true,
    brandId: brand.id,
    lineId: line.id,
    target: 'engine',
    engineId: engine.id,
    payload: {
      selections,
      sizes,
      descripcion: text,
      genericoKey: generico.value ? genericKey(brandGenericos, generico.value) : '',
      rowData: Object.fromEntries(rows.map((row) => [`.${row.talle.value}`, { ean: row.ean.value }])),
    },
  }
}
