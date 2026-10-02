// Qué se puede dar de alta en "Altas de referencia" y dónde se guarda cada cosa.
// Cada destino (target) es una tabla de referencia de CODIFICACION 2023 que usan los motores:
// lista de destino, campos del formulario, forma del registro y columnas del Excel de altas.
import {
  ALL_GENERICOS,
  COLORS,
  GENERICOS,
  REGLA_CASCOS,
  REGLA_CASCOS_GUD,
  REGLA_PRODUCTO,
  REGLA_PRODUCTO_GUD,
} from '../data/realData'
import { FREE_DIGIT_RANGE } from '../rules/constants'
import { BRANDS, CUSTOM_CASCOS } from '../engines/engines'
import { tangoDescription } from '../rules/descriptions'

export const KINDS = {
  marca: 'Marca nueva',
  calota: 'Modelo / calota de casco',
  grafica: 'Gráfica',
  color: 'Conjunto de colores',
  tipologia: 'Tipología',
  articulo: 'Modelo / artículo de producto',
  familia: 'Familia de producto',
  genero: 'Género',
  origen: 'Origen',
  generico: 'Código genérico',
}

const SHEETS = {
  cascos: 'REFERENCIA CASCOS',
  producto: 'REFERENCIA PRODUCTO',
  cascosGud: 'REF. CASCOS GUD',
  productoGud: 'REF. INDUMENTARIA GUD',
  generico: 'CODIFICACION GENERICOS',
  ls2: 'LS2 (tabla de colores)',
}

const uppercase = (value) => String(value ?? '').trim().toUpperCase()

const codeField = (length) => ({
  name: 'codigo',
  label: `Código (${length})`,
  required: true,
  mono: true,
  length,
  hint: `${length} caracteres: letras mayúsculas y números.`,
})
const nameField = (label = 'Nombre', hint) => ({ name: 'descripcion', label, required: true, hint })

const familyOptions = () => REGLA_PRODUCTO.familias.map((family) => ({ value: family.descripcion, label: family.descripcion }))

/** Destino simple: tabla { descripcion, codigo, ...extras }. */
function catalogTarget({ id, kind, label, sheet, codeLength, list, extraFields = [], scope = [], suggest }) {
  return {
    id,
    kind,
    label,
    sheet,
    codeLength,
    scopeFields: scope,
    fields: [...scope, codeField(codeLength), nameField(), ...extraFields],
    list: (values) => list(values),
    record: (values) => ({
      descripcion: uppercase(values.descripcion),
      codigo: uppercase(values.codigo),
      ...Object.fromEntries(extraFields.map((field) => [field.name, uppercase(values[field.name]) || null])),
    }),
    suggest,
  }
}

/** Abreviatura sugerida para un conjunto de colores: BLACK BLUE GLOSS → BK/BL GS (con la tabla de colores). */
const suggestColorAbbreviation = (values) => {
  const description = uppercase(values.descripcion)
  if (!description) return {}
  const { text } = tangoDescription(description, null)
  return text && text !== description ? { abreviatura: text } : {}
}

const COLOR_FIELDS = [
  { name: 'abreviatura', label: 'Abreviatura (para la descripción Tango)', hint: 'Ej.: BK/BL GS. Se sugiere según la tabla de colores.' },
  { name: 'espanol', label: 'Equivalente en español', hint: 'Ej.: NEGRO AZUL BRILLO.' },
]

const tipoOptions = () => [...new Set(REGLA_CASCOS.tipologias.map((item) => item.tipo).filter(Boolean))].map((tipo) => ({ value: tipo, label: tipo }))

const STATIC_TARGETS = [
  // ── Modelos / calotas de casco ──
  catalogTarget({ id: 'calota-MAC', kind: 'calota', label: 'MAC', sheet: SHEETS.cascos, codeLength: 3, list: () => REGLA_CASCOS.calotasMAC }),
  catalogTarget({ id: 'calota-UBX', kind: 'calota', label: 'URBAX', sheet: SHEETS.cascos, codeLength: 3, list: () => REGLA_CASCOS.calotasURBAX }),

  // ── Gráficas ──
  catalogTarget({ id: 'grafica-MAC', kind: 'grafica', label: 'Cascos MAC', sheet: SHEETS.cascos, codeLength: 2, list: () => REGLA_CASCOS.graficasMAC }),
  catalogTarget({ id: 'grafica-UBX', kind: 'grafica', label: 'Cascos URBAX', sheet: SHEETS.cascos, codeLength: 2, list: () => REGLA_CASCOS.graficasURBAX }),
  catalogTarget({ id: 'grafica-GUD', kind: 'grafica', label: 'Cascos GUD', sheet: SHEETS.cascosGud, codeLength: 2, list: () => REGLA_CASCOS_GUD.graficas }),

  // ── Conjuntos de colores ──
  catalogTarget({
    id: 'color-cascos',
    kind: 'color',
    label: 'Cascos MAC / URBAX',
    sheet: SHEETS.cascos,
    codeLength: 2,
    list: () => REGLA_CASCOS.colores,
    extraFields: COLOR_FIELDS,
    suggest: suggestColorAbbreviation,
  }),
  catalogTarget({
    id: 'color-cascos-GUD',
    kind: 'color',
    label: 'Cascos GUD',
    sheet: SHEETS.cascosGud,
    codeLength: 2,
    list: () => REGLA_CASCOS_GUD.colores,
    extraFields: [COLOR_FIELDS[0]],
  }),
  catalogTarget({
    id: 'color-producto',
    kind: 'color',
    label: 'Producto MAC / NTO / 921',
    sheet: SHEETS.producto,
    codeLength: 2,
    list: () => REGLA_PRODUCTO.colores,
    extraFields: [COLOR_FIELDS[0]],
  }),
  catalogTarget({
    id: 'color-producto-GUD',
    kind: 'color',
    label: 'Producto GUD',
    sheet: SHEETS.productoGud,
    codeLength: 2,
    list: () => REGLA_PRODUCTO_GUD.colores,
    extraFields: [COLOR_FIELDS[0]],
  }),
  {
    // LS2 no codifica colores en el SKU: la tabla solo traduce la descripción Tango (inglés → abreviatura).
    id: 'color-LS2',
    kind: 'color',
    label: 'LS2 (descripción Tango)',
    sheet: SHEETS.ls2,
    codeLength: 0,
    scopeFields: [],
    fields: [
      { name: 'ingles', label: 'Color en inglés', required: true, hint: 'Ej.: BLACK. Es lo que aparece en la descripción del mail.' },
      { name: 'abreviatura', label: 'Abreviatura', required: true, hint: 'Ej.: BK.' },
      { name: 'espanol', label: 'Equivalente en español', required: true, hint: 'Ej.: NEGRO.' },
    ],
    list: () => COLORS,
    record: (values) => ({ espanol: uppercase(values.espanol), ingles: uppercase(values.ingles), abreviatura: uppercase(values.abreviatura) }),
    noCode: true,
  },

  // ── Tipologías ──
  catalogTarget({
    id: 'tipologia-cascos',
    kind: 'tipologia',
    label: 'Cascos MAC / URBAX',
    sheet: SHEETS.cascos,
    codeLength: 2,
    list: () => REGLA_CASCOS.tipologias,
    extraFields: [{ name: 'tipo', label: 'Tipo', type: 'select', options: tipoOptions, hint: 'Agrupa la tipología: FF, MX, OF…' }],
  }),
  catalogTarget({ id: 'tipologia-cascos-GUD', kind: 'tipologia', label: 'Cascos GUD', sheet: SHEETS.cascosGud, codeLength: 2, list: () => REGLA_CASCOS_GUD.tipologias }),
  catalogTarget({
    id: 'tipologia-producto',
    kind: 'tipologia',
    label: 'Producto MAC / NTO / 921',
    sheet: SHEETS.producto,
    codeLength: 2,
    scope: [{ name: 'familia', label: 'Familia', required: true, type: 'select', options: familyOptions }],
    list: (values) => (REGLA_PRODUCTO.tipologiasPorFamilia[values.familia] ??= []),
  }),
  catalogTarget({ id: 'tipologia-producto-GUD', kind: 'tipologia', label: 'Producto GUD', sheet: SHEETS.productoGud, codeLength: 2, list: () => REGLA_PRODUCTO_GUD.tipologias }),

  // ── Modelos / artículos de producto ──
  catalogTarget({
    id: 'articulo-producto',
    kind: 'articulo',
    label: 'Producto MAC / NTO / 921',
    sheet: SHEETS.producto,
    codeLength: 2,
    scope: [
      {
        name: 'linea',
        label: 'Línea del artículo',
        required: true,
        type: 'select',
        options: () => Object.keys(REGLA_PRODUCTO.articulosPorModelo).map((line) => ({ value: line, label: line })),
      },
    ],
    list: (values) => (REGLA_PRODUCTO.articulosPorModelo[values.linea] ??= []),
  }),
  catalogTarget({ id: 'articulo-producto-GUD', kind: 'articulo', label: 'Producto GUD', sheet: SHEETS.productoGud, codeLength: 2, list: () => REGLA_PRODUCTO_GUD.articulos }),

  // ── Tablas comunes del producto (MAC, NTO, 921 y GUD): familia, género y origen ──
  catalogTarget({ id: 'familia-producto', kind: 'familia', label: 'Producto', sheet: SHEETS.producto, codeLength: 1, list: () => REGLA_PRODUCTO.familias }),
  catalogTarget({
    id: 'genero-producto',
    kind: 'genero',
    label: 'Producto',
    sheet: SHEETS.producto,
    codeLength: 1,
    list: () => REGLA_PRODUCTO.generos,
    extraFields: [{ name: 'abreviatura', label: 'Abreviatura', hint: 'Ej.: HM.' }],
  }),
  catalogTarget({ id: 'origen-producto', kind: 'origen', label: 'Producto', sheet: SHEETS.producto, codeLength: 1, list: () => REGLA_PRODUCTO.origenes }),

  // ── Código genérico (solo consulta) ──
  {
    id: 'generico',
    kind: 'generico',
    label: 'Todas las marcas',
    sheet: SHEETS.generico,
    codeLength: 0,
    scopeFields: [],
    fields: [
      { name: 'marca', label: 'Marca', required: true, type: 'select', options: () => BRANDS.map((brand) => ({ value: brand.id, label: brand.label })) },
      { name: 'codigo', label: 'Código genérico', required: true, mono: true, hint: 'Ej.: UBX010313AB-GR.' },
      { name: 'familia', label: 'Familia', required: true, type: 'select', options: familyOptions },
      { name: 'tipologia', label: 'Tipología', required: true, hint: 'Ej.: INTEGRAL.' },
      { name: 'modelo', label: 'Modelo', required: true, hint: 'Ej.: AVA.' },
      { name: 'genero', label: 'Género / tipo', hint: 'Ej.: HOMBRE, SOLID o GRAFICA.' },
      { name: 'descripcion', label: 'Descripción', required: true, hint: 'Ej.: FF313 AVA AB GRAFICA.' },
    ],
    list: () => ALL_GENERICOS,
    // Solo consulta: el genérico no es un dato de referencia que se carga como alta, se crea al generar el SKU.
    readOnly: true,
    readOnlyNote: 'Los códigos genéricos no se cargan como alta: se crean al generar el SKU (el genérico es el mismo SKU sin talle).',
    noCode: true,
  },

  // ── Marca nueva ──
  {
    id: 'marca',
    kind: 'marca',
    label: 'Todas las marcas',
    sheet: 'REFERENCIA PRODUCTO / REFERENCIA CASCOS (columna de marcas)',
    codeLength: 3,
    scopeFields: [],
    fields: [
      { ...codeField(3), hint: '3 caracteres: es el segmento de marca del SKU (ej.: MAC, UBX).' },
      nameField('Nombre', 'Ej.: URBAX.'),
      {
        name: 'plantilla',
        label: 'Cómo se arma el SKU',
        required: true,
        type: 'select',
        options: () => [
          { value: 'cascos', label: 'Cascos: marca + tipología + calota + gráfica + color + talle (como MAC / URBAX)' },
          { value: 'producto', label: 'Producto: origen + marca + familia + tipología + género + artículo + color + talle (como NTO)' },
          { value: 'ambos', label: 'Las dos líneas: cascos y producto' },
        ],
      },
    ],
    list: () => BRANDS,
    record: (values) => ({ id: uppercase(values.codigo), label: uppercase(values.descripcion), plantilla: values.plantilla }),
  },
]

/** Destinos de las marcas de cascos creadas por el usuario (calotas y gráficas propias). */
function customBrandTargets() {
  return Object.keys(CUSTOM_CASCOS).flatMap((brand) => [
    catalogTarget({ id: `calota-${brand}`, kind: 'calota', label: brand, sheet: SHEETS.cascos, codeLength: 3, list: () => CUSTOM_CASCOS[brand].calotas }),
    catalogTarget({ id: `grafica-${brand}`, kind: 'grafica', label: `Cascos ${brand}`, sheet: SHEETS.cascos, codeLength: 2, list: () => CUSTOM_CASCOS[brand].graficas }),
  ])
}

export const getTargets = () => [...STATIC_TARGETS, ...customBrandTargets()].map((target) => ({ ...target, kindLabel: KINDS[target.kind] }))

// ── A qué marcas y familias aplica cada tabla ─────────────

const CASCOS_FAMILIES = ['CASCOS', 'REPUESTOS']
const cascosBrands = () => ['MAC', 'UBX', ...Object.keys(CUSTOM_CASCOS)]
const productBrands = () =>
  BRANDS.filter((brand) => !['LS2', 'GUD'].includes(brand.id) && brand.lines?.some((line) => line.id === 'producto')).map((brand) => brand.id)
const productFamilies = () => REGLA_PRODUCTO.familias.map((family) => family.descripcion)

/** Marcas y familias de cada destino; `null` = todas. Las tablas de marcas nuevas de cascos se derivan del id. */
const APPLIES = {
  'calota-MAC': { brands: () => ['MAC'], families: () => CASCOS_FAMILIES },
  'calota-UBX': { brands: () => ['UBX'], families: () => CASCOS_FAMILIES },
  'grafica-MAC': { brands: () => ['MAC'], families: () => CASCOS_FAMILIES },
  'grafica-UBX': { brands: () => ['UBX'], families: () => CASCOS_FAMILIES },
  'grafica-GUD': { brands: () => ['GUD'], families: () => ['CASCOS'] },
  'color-cascos': { brands: cascosBrands, families: () => CASCOS_FAMILIES },
  'color-cascos-GUD': { brands: () => ['GUD'], families: () => ['CASCOS'] },
  'color-producto': { brands: productBrands, families: productFamilies },
  'color-producto-GUD': { brands: () => ['GUD'], families: productFamilies },
  'color-LS2': { brands: () => ['LS2'], families: null },
  'tipologia-cascos': { brands: cascosBrands, families: () => CASCOS_FAMILIES },
  'tipologia-cascos-GUD': { brands: () => ['GUD'], families: () => ['CASCOS'] },
  'tipologia-producto': { brands: productBrands, families: productFamilies },
  'tipologia-producto-GUD': { brands: () => ['GUD'], families: productFamilies },
  'articulo-producto': { brands: productBrands, families: productFamilies },
  'articulo-producto-GUD': { brands: () => ['GUD'], families: productFamilies },
  'familia-producto': { brands: () => [...productBrands(), 'GUD'], families: null },
  'genero-producto': { brands: () => [...productBrands(), 'GUD'], families: null },
  'origen-producto': { brands: () => [...productBrands(), 'GUD'], families: null },
  generico: { brands: null, families: null },
  marca: { brands: null, families: null },
}

const ruleOf = (target) => {
  const custom = /^(calota|grafica)-(.+)$/.exec(target.id)
  return APPLIES[target.id] ?? (custom ? { brands: () => [custom[2]], families: () => CASCOS_FAMILIES } : { brands: null, families: null })
}

/** ¿La tabla corresponde a la marca y familia elegidas? (vacío = cualquiera) */
export function appliesTo(target, { brand = '', family = '' } = {}) {
  const rule = ruleOf(target)
  return (!brand || !rule.brands || rule.brands().includes(brand)) && (!family || !rule.families || rule.families().includes(family))
}

/** Marcas a las que sirve una tabla (null = a todas). */
export const brandsOf = (target) => ruleOf(target).brands?.() ?? null

/**
 * Tablas en las que se puede dar de alta algo para una marca. No están la marca nueva (no depende de una marca)
 * ni las tablas de solo consulta (los genéricos).
 */
export const targetsOfBrand = (brand) => getTargets().filter((target) => target.kind !== 'marca' && !target.readOnly && appliesTo(target, { brand }))

/** Qué tipos de alta admite una marca, en el orden de siempre. */
export const kindsOfBrand = (brand) => Object.keys(KINDS).filter((kind) => targetsOfBrand(brand).some((target) => target.kind === kind))

/** Valor del selector de marca para dar de alta una marca nueva. */
export const NEW_BRAND = '__nueva__'

/** Familias de producto, para el filtro. */
export const familyNames = () => productFamilies()
export const getTarget = (id) => getTargets().find((target) => target.id === id) ?? null
export const targetsOfKind = (kind) => getTargets().filter((target) => target.kind === kind)

const PATTERN = /^[0-9A-Z]+$/

const plantillaOf = (brand) => {
  if (brand.plantilla) return brand.plantilla
  const ids = (brand.lines ?? []).map((line) => line.id)
  if (ids.includes('cascos') && ids.includes('producto')) return 'ambos'
  return ids[0] ?? 'propio'
}

/** Códigos que figuran más de una vez en una lista de registros. */
export function repeatedCodes(records) {
  const counts = new Map()
  records.forEach(({ values }) => {
    if (values.codigo) counts.set(values.codigo, (counts.get(values.codigo) ?? 0) + 1)
  })
  return new Set([...counts].filter(([, times]) => times > 1).map(([code]) => code))
}

/** Combinaciones de ámbito (familia, línea…) de una tabla: una por cada valor posible. */
function scopeCombos(target) {
  return target.scopeFields.reduce(
    (combos, field) => combos.flatMap((combo) => field.options().map((option) => ({ ...combo, [field.name]: option.value }))),
    [{}],
  )
}

/**
 * Todos los códigos que figuran más de una vez en las tablas de referencia que corresponden a la marca y
 * familia elegidas (sin filtro: todas). Es lo que usan los SKU para armarse: si un código sirve para dos
 * nombres, dos productos distintos pueden quedar con el mismo código. No incluye las altas de la herramienta
 * (se validan para que no repitan) ni los códigos genéricos (se crean al generar el SKU, no son datos de referencia).
 * @returns {{ id, targetId, kind, tabla, ambito, scope, codigo, nombres: string[], veces: number, conflicto: boolean }[]}
 *   `conflicto` = nombres distintos para el mismo código; si no, es el mismo nombre en filas repetidas.
 */
export function duplicateCases({ brand = '', family = '' } = {}) {
  const cases = []
  getTargets()
    .filter((target) => target.kind !== 'marca' && target.kind !== 'generico' && target.fields.some((field) => field.name === 'codigo') && appliesTo(target, { brand, family }))
    .forEach((target) => {
      scopeCombos(target).forEach((scope) => {
        if (family && scope.familia && scope.familia !== family) return
        const records = listRecords(target, scope).filter((record) => !record.alta)

        const names = new Map()
        records.forEach(({ values }) => names.set(values.codigo, [...(names.get(values.codigo) ?? []), values.descripcion ?? '']))
        names.forEach((list, codigo) => {
          if (list.length < 2) return
          const nombres = [...new Set(list)]
          cases.push({
            id: `${target.id}|${JSON.stringify(scope)}|${codigo}`,
            targetId: target.id,
            kind: target.kind,
            tabla: `${KINDS[target.kind]} · ${target.label}`,
            ambito: Object.values(scope).join(' · '),
            scope,
            codigo,
            nombres,
            veces: list.length,
            conflicto: nombres.length > 1,
          })
        })
      })
    })
  // Primero los que mezclan nombres distintos (los que importan), después los de un mismo nombre repetido.
  return cases.sort((a, b) => Number(b.conflicto) - Number(a.conflicto) || a.tabla.localeCompare(b.tabla) || a.ambito.localeCompare(b.ambito) || a.codigo.localeCompare(b.codigo))
}

/** Filtra los registros de una tabla por lo que se escribió, en cualquier columna (sin distinguir mayúsculas). */
export function searchRecords(records, columns, query) {
  const needle = String(query ?? '').trim().toUpperCase()
  if (!needle) return records
  return records.filter(({ values }) => columns.some((field) => String(values[field.name] ?? '').toUpperCase().includes(needle)))
}

/** Columnas de la tabla de un destino: sus campos, sin los que solo eligen el ámbito (familia, línea). */
export const tableColumns = (target) => target.fields.filter((field) => !target.scopeFields.includes(field))

/**
 * Lo que hay hoy en la tabla de un destino: los registros de CODIFICACION 2023 y las altas,
 * con los datos como los pide el formulario. `alta` es el id del alta si el registro es nuevo.
 */
export function listRecords(target, scope = {}) {
  if (target.scopeFields.some((field) => field.required && !scope[field.name])) return []
  return (target.list(scope) ?? []).map((record) => ({
    alta: record.alta ?? null,
    values: target.kind === 'marca' ? { codigo: record.id, descripcion: record.label, plantilla: plantillaOf(record) } : record,
  }))
}

/**
 * Controla un alta: devuelve { errors: { campo: mensaje }, duplicate }. Cada campo se controla por separado,
 * así el formulario puede marcar en vivo el que no se puede usar (ej. un código que ya existe) aunque falten otros.
 * `duplicate` es el primer registro ya existente que choca, para explicarlo.
 */
export function validateAlta(target, values) {
  const errors = {}
  const text = (name) => String(values[name] ?? '').trim()
  target.fields.forEach((field) => {
    if (field.required && !text(field.name)) errors[field.name] = 'Completá este dato.'
  })

  const code = uppercase(values.codigo)
  if (target.codeLength && code && (code.length !== target.codeLength || !PATTERN.test(code))) {
    errors.codigo = `Debe tener ${target.codeLength} caracteres: letras mayúsculas y números.`
  }

  // Los repetidos solo se buscan si ya se eligió el ámbito (familia, línea) de la tabla.
  const scopeReady = target.scopeFields.every((field) => !field.required || text(field.name))
  const name = uppercase(values.descripcion)
  let duplicate = null
  if (scopeReady) {
    const list = target.list(values) ?? []
    if (target.kind === 'marca') {
      const sameCode = code && !errors.codigo ? BRANDS.find((brand) => brand.id === code) : null
      const sameName = name ? BRANDS.find((brand) => brand.label === name) : null
      if (sameCode) errors.codigo = `Ya existe la marca ${sameCode.label} (${sameCode.id}).`
      if (sameName) errors.descripcion = `Ya existe la marca ${sameName.label} (${sameName.id}).`
      duplicate = sameCode ?? sameName
    } else if (target.kind === 'color' && target.noCode) {
      const english = uppercase(values.ingles)
      duplicate = english ? list.find((item) => item.ingles === english) : null
      if (duplicate) errors.ingles = `Ya está en la tabla (${duplicate.abreviatura}).`
    } else {
      const sameCode = code && !errors.codigo ? list.find((item) => item.codigo === code) : null
      const sameName = name ? list.find((item) => item.descripcion === name) : null
      if (sameCode) errors.codigo = `El código ${code} ya lo usa ${sameCode.descripcion}.`
      if (sameName) errors.descripcion = `Ya existe con el código ${sameName.codigo}.`
      duplicate = sameCode ?? sameName
    }
  }
  return { errors, duplicate }
}

/**
 * Código sugerido en tablas de 2 caracteres: el siguiente al último que tiene la tabla, en el orden de los
 * códigos (01–99, A1…A9, A0, B1… Z0, 1A…0Z), saltando los que ya están usados. Se parte del último de la tabla
 * y no del más alto: hay códigos sueltos más adelante (ej. colores de cascos: la tabla llega a J4 y hay un K0).
 */
export function suggestCode(target, values = {}) {
  if (target.codeLength !== 2) return ''
  const list = target.list(values) ?? []
  const used = new Set(list.map((item) => item.codigo))
  const last = list.map((item) => item.codigo).filter((code) => FREE_DIGIT_RANGE.includes(code)).at(-1)
  const from = last ? FREE_DIGIT_RANGE.indexOf(last) + 1 : 0
  return [...FREE_DIGIT_RANGE.slice(from), ...FREE_DIGIT_RANGE.slice(0, from)].find((code) => !used.has(code)) ?? ''
}

const PLANTILLA_SHORT = { cascos: 'Cascos', producto: 'Producto', ambos: 'Cascos y producto' }

/**
 * Una fila real de la tabla (no una alta) para mostrar al lado de cada campo: qué se espera cargar.
 * Devuelve { campo: texto }. En las tablas con ámbito (familia, línea) usa el elegido o, si no, el primero.
 */
export function exampleOf(target, values = {}) {
  if (target.kind === 'marca') {
    const brand = BRANDS.find((item) => item.id === 'UBX') ?? BRANDS.find((item) => item.lines)
    return { codigo: brand.id, descripcion: brand.label, plantilla: PLANTILLA_SHORT[plantillaOf(brand)] }
  }

  const scope = Object.fromEntries(target.scopeFields.map((field) => [field.name, values[field.name] || field.options()[0]?.value || '']))
  const list = (target.list({ ...values, ...scope }) ?? []).filter((item) => !item.alta)
  const fields = target.fields.filter((field) => !target.scopeFields.includes(field))
  const complete = (item) => fields.every((field) => item[field.name])
  const record = [...list].reverse().find(complete) ?? list.at(-1) ?? {}
  return { ...scope, ...Object.fromEntries(fields.map((field) => [field.name, record[field.name] ?? ''])) }
}

export const isAltaComplete = (target, values) => Object.keys(validateAlta(target, values).errors).length === 0
