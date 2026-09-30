// Adaptador entre la interpretación y la pantalla: traduce los datos (ya revisados
// por el usuario) al estado de LS2 o del motor de la marca. No completa nada que
// no venga de la interpretación.
import { ALL_GENERICOS, GENERICOS, REGLA_PRODUCTO } from '../data/realData'
import { BRANDS } from '../engines/engines'
import { FAMILY_LIST } from '../rules/families'

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
 * @returns {{ ok: true, brandId, lineId, target, payload } | { ok: false, reason }}
 */
export function toScreenLoad(draft) {
  const { marca, familia, generico, descripcion } = draft.fields
  const brand = BRANDS.find((item) => item.id === marca.value)
  if (!brand) return { ok: false, reason: 'Completá la marca para saber dónde cargar los datos.' }

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
      rowData = Object.fromEntries(
        withCode.map((row) => [row.codigoProveedor.value, { barras: row.barras.value, ean: row.ean.value }]),
      )
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
