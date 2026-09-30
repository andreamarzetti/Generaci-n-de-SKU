// Interpretación de una solicitud de alta pegada (mail y/o filas de Excel).
// Reglas de oro: no inventar datos, marcar el origen de cada dato y no elegir
// cuando hay más de un candidato. Sin IA ni APIs: solo reglas.
import { descriptionWithoutSize } from '../rules/descriptions'
import { DEFAULT_CATALOGS } from './catalogs'
import { field, missing, normalizeText, STATUS } from './normalize'
import { extractTable } from './table'
import { readText } from './text'

const { DETECTED, DEDUCED } = STATUS
const unique = (values) => [...new Set(values.filter(Boolean))]

/**
 * @param {string} input  Texto pegado.
 * @param {object} catalogs  Genéricos, marcas, familias y talles (inyectables).
 * @returns Campos con estado (detectado / deducido / completar), filas por talle,
 *          candidatos cuando hay más de uno y mensajes para el usuario.
 */
export function interpretRequest(input, catalogs = DEFAULT_CATALOGS) {
  const table = extractTable(input)
  const text = readText(table.otherLines, catalogs)
  const genericByCode = new Map(catalogs.genericos.map((generico) => [generico.codigo, generico]))

  // ── Genérico: columna SKU que coincide con un genérico, o candidatos por modelo ──
  const tableGenericCodes = unique(table.rows.map((row) => (genericByCode.has(row.sku) ? row.sku : null)))
  const tableModels = unique(table.rows.map((row) => row.modelo?.split(' ')[0]))
  const models = unique([...tableModels, ...text.models])

  // ── Marca ──
  const tableBrands = unique(table.rows.map((row) => brandIdFromName(row.marca, catalogs)))
  let marca
  if (tableBrands.length === 1) marca = field(tableBrands[0], DETECTED, 'Columna MARCA de la tabla')
  else if (text.brands.length === 1) marca = field(text.brands[0], DETECTED, 'Nombrada en el texto')
  else marca = { ...missing(), candidates: unique([...tableBrands, ...text.brands]) }

  let candidates = []
  let generico
  if (tableGenericCodes.length === 1) {
    generico = field(tableGenericCodes[0], DETECTED, 'Columna SKU de la tabla (coincide con un código genérico)')
  } else {
    candidates = genericCandidates(models, catalogs.genericos, marca.value)
    generico =
      candidates.length === 1
        ? field(candidates[0].codigo, DEDUCED, `Único genérico para el modelo ${models[0]}`)
        : { ...missing(candidates.length > 1 ? `El modelo ${models[0]} tiene ${candidates.length} genéricos posibles` : ''), candidates }
  }
  const chosenGeneric = generico.value ? genericByCode.get(generico.value) : null

  if (!marca.value) {
    const fromGenerics = unique((chosenGeneric ? [chosenGeneric] : candidates).map((item) => brandIdFromName(item.marca, catalogs)))
    if (fromGenerics.length === 1) {
      marca = field(fromGenerics[0], DEDUCED, `Deducida por el modelo ${models[0] ?? ''} en los genéricos`.trim())
    }
  }

  // ── Familia ──
  const tableFamilies = unique(table.rows.map((row) => familyFromName(row.familia, catalogs)))
  let familia
  if (tableFamilies.length === 1) familia = field(tableFamilies[0], DETECTED, 'Columna FAMILIA de la tabla')
  else if (text.families.length === 1) familia = field(text.families[0], DETECTED, 'Nombrada en el texto')
  else {
    const fromGenerics = unique((chosenGeneric ? [chosenGeneric] : candidates).map((item) => item.familia))
    familia =
      fromGenerics.length === 1
        ? field(fromGenerics[0], DEDUCED, `Deducida por el modelo ${models[0] ?? ''} en los genéricos`.trim())
        : missing()
  }

  // ── Descripción: la de la tabla sin el talle, o la línea del mail que nombra el modelo ──
  const tableDescription = table.rows.find((row) => row.descripcion)
  const descripcion = tableDescription
    ? field(descriptionWithoutSize(tableDescription.descripcion, tableDescription.talle), DETECTED, 'Columna DESCRIPCION de la tabla, sin el talle')
    : text.description
      ? field(descriptionWithoutSize(text.description), DEDUCED, 'Línea del mail que menciona el modelo')
      : missing()

  const rows = buildRows(table.rows, text, catalogs, genericByCode)
  // Números de 13 dígitos en líneas sin talle: no se asignan solos.
  const looseNumbers = unique(
    text.rows.filter((row) => !row.size).flatMap((row) => [row.barras?.value, row.ean?.value, ...row.unresolved]),
  )

  const recognized = Boolean(marca.value || marca.candidates?.length || familia.value || generico.value || candidates.length || descripcion.value || rows.length || looseNumbers.length)
  return {
    empty: !recognized,
    source: table.rows.length ? (text.models.length || text.rows.length ? 'tabla y texto' : 'tabla') : 'texto',
    message: recognized
      ? null
      : 'No se reconoció ningún dato: ni marca, ni modelo, ni talles, ni códigos de barras o EAN. Revisá el texto o cargá los datos a mano.',
    fields: { marca, familia, generico, descripcion },
    candidates,
    rows,
    looseNumbers,
  }
}

function brandIdFromName(name, catalogs) {
  if (!name) return null
  const normalized = normalizeText(name)
  return catalogs.brands.find((brand) => brand.id === normalized || brand.names.includes(normalized))?.id ?? null
}

function familyFromName(name, catalogs) {
  if (!name) return null
  const normalized = normalizeText(name)
  return catalogs.families.find((family) => family.names.includes(normalized))?.familia ?? null
}

/** Genéricos cuya descripción empieza con el modelo (FF806 → "FF806 FUSION AB GRAFICA"). */
function genericCandidates(models, genericos, brandId) {
  const found = genericos.filter((generico) => {
    const first = generico.descripcion?.split(/\s+/)[0]
    return first && models.includes(first) && (!brandId || generico.marca === brandId)
  })
  return [...new Map(found.map((generico) => [generico.key, generico])).values()]
}

/** Filas por talle: la tabla manda; el texto completa lo que falte. */
function buildRows(tableRows, text, catalogs, genericByCode) {
  const bySize = new Map()
  const ensure = (size) => {
    if (!bySize.has(size.value)) {
      bySize.set(size.value, {
        talle: field(size.value, DETECTED, size.normalized ? `Recibido ${size.raw}: normalizado a ${size.value}` : ''),
        talleRecibido: size.raw,
        barras: missing(),
        ean: missing(),
        codigoProveedor: missing(),
        unresolved: [],
      })
    }
    return bySize.get(size.value)
  }

  tableRows.forEach((row) => {
    const size = catalogs.normalizeSize(row.talle ?? '')
    if (!size.recognized) return
    const target = ensure(size)
    if (row.barras) target.barras = field(row.barras.replace(/\D/g, ''), DETECTED, 'Columna BARRAS de la tabla')
    if (row.ean) target.ean = field(row.ean.replace(/\D/g, ''), DETECTED, 'Columna EAN de la tabla')
    if (row.sku && !genericByCode.has(row.sku)) {
      target.codigoProveedor = field(row.sku, DETECTED, 'Columna SKU de la tabla (no es un código genérico)')
    }
  })

  text.rows.forEach((row) => {
    if (!row.size) return
    const target = ensure(row.size)
    if (!target.barras.value && row.barras) target.barras = field(row.barras.value, row.barras.how === 'detected' ? DETECTED : DEDUCED, row.barras.reason)
    if (!target.ean.value && row.ean) target.ean = field(row.ean.value, row.ean.how === 'detected' ? DETECTED : DEDUCED, row.ean.reason)
    target.unresolved = unique([...target.unresolved, ...row.unresolved])
  })

  // Talles de un rango del mail ("S a 2X") que no vinieron en ninguna línea.
  text.range?.sizes.forEach((value) => {
    if (!bySize.has(value)) {
      const target = ensure({ value, raw: value, normalized: false })
      target.talle = field(value, DETECTED, `Rango "${text.range.raw}" del mail`)
    }
  })

  const order = catalogs.sizeOrder
  return [...bySize.values()].sort((a, b) => order.indexOf(a.talle.value) - order.indexOf(b.talle.value))
}
