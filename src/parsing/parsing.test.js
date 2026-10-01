import { afterEach, describe, expect, it } from 'vitest'
import { ENGINES } from '../engines/engines'
import { buildEngineProposal } from '../engines/proposal'
import { acceptAltas, createAlta, resetAltas } from '../reference/store'
import { applyChoices, COMPONENT_STATUS, decomposeDescription, selectionsFromParts } from './components'
import { buildProposal } from '../rules/buildProposal'
import { FAMILIES } from '../rules/families'
import { PASTE_EXAMPLES } from './examples'
import { interpretRequest } from './interpret'
import { STATUS } from './normalize'
import { headerField } from './table'
import { classifyNumbers, sizesFromRange } from './text'
import { toScreenLoad } from './toScreen'
import { DEFAULT_CATALOGS } from './catalogs'

const example = (id) => PASTE_EXAMPLES.find((item) => item.id === id).text
const ANDRES_SKUS = ['LS2980600201.S', 'LS2980600201.M', 'LS2980600201.L', 'LS2980600201.XL', 'LS2980600201.2X']
const EXPECTED_ROWS = [
  ['S', '9806002025011', '6937449162997'],
  ['M', '9806002025010', '6937449163000'],
  ['L', '9806002025009', '6937449163017'],
  ['XL', '9806002025008', '6937449163024'],
  ['2X', '9806002025007', '6937449163031'],
]

/** Carga la interpretación en LS2 y arma los SKUs con el motor real (sin dígitos usados). */
function skusAfterLoading(result) {
  const load = toScreenLoad(result)
  expect(load.ok).toBe(true)
  expect(load.brandId).toBe('LS2')
  const { familyId, form, rowData } = load.payload
  return buildProposal(FAMILIES[familyId], { form, rowData }).rows.map((row) => row.sku)
}

const rowsOf = (result) => result.rows.map((row) => [row.talle.value, row.barras.value, row.ean.value])

describe('ejemplo 1: filas de Excel', () => {
  const result = interpretRequest(example('excel'))

  it('detecta marca, familia, genérico (columna SKU) y descripción sin talle', () => {
    expect(result.fields.marca).toMatchObject({ value: 'LS2', status: STATUS.DETECTED })
    expect(result.fields.familia).toMatchObject({ value: 'CASCOS', status: STATUS.DETECTED })
    expect(result.fields.generico).toMatchObject({ value: 'LS2010806AB-GR', status: STATUS.DETECTED })
    expect(result.fields.descripcion.value).toBe('FF806 FUSION TECK LIGHT GRAY RED GLOSS')
  })

  it('lee los 5 talles con sus barras y EAN; XXL se normaliza a 2X', () => {
    expect(rowsOf(result)).toEqual(EXPECTED_ROWS)
    const last = result.rows.at(-1)
    expect(last.talleRecibido).toBe('XXL')
    expect(last.talle.reason).toBe('Recibido XXL: normalizado a 2X')
  })

  it('carga directo, sin preguntar, y arma los SKU de Andrés', () => {
    expect(result.candidates).toEqual([])
    expect(skusAfterLoading(result)).toEqual(ANDRES_SKUS)
  })
})

describe('ejemplo 2: texto de mail', () => {
  const result = interpretRequest(example('mail'))

  it('deduce marca y familia por el modelo', () => {
    expect(result.fields.marca).toMatchObject({ value: 'LS2', status: STATUS.DEDUCED })
    expect(result.fields.marca.reason).toContain('FF806')
    expect(result.fields.familia).toMatchObject({ value: 'CASCOS', status: STATUS.DEDUCED })
    expect(result.fields.descripcion).toMatchObject({ value: 'FF806 FUSION TECK LIGHT GRAY RED GLOSS', status: STATUS.DEDUCED })
  })

  it('muestra los dos genéricos posibles y no elige ninguno', () => {
    expect(result.fields.generico).toMatchObject({ value: '', status: STATUS.MISSING })
    expect(result.candidates.map((item) => item.codigo).sort()).toEqual(['LS2010806AB-GR', 'LS2010806AB-SD'])
  })

  it('lee los 5 talles del rango con sus barras y EAN por palabra clave', () => {
    expect(rowsOf(result)).toEqual(EXPECTED_ROWS)
    result.rows.forEach((row) => {
      expect(row.barras.status).toBe(STATUS.DETECTED)
      expect(row.ean.status).toBe(STATUS.DETECTED)
    })
  })

  it('al elegir LS2010806AB-GR, arma exactamente los SKU de Andrés', () => {
    const chosen = { ...result, fields: { ...result.fields, generico: { value: 'LS2010806AB-GR', status: STATUS.EDITED } } }
    expect(skusAfterLoading(chosen)).toEqual(ANDRES_SKUS)
    expect(toScreenLoad(chosen).payload.form.generico).toBe('LS2010806AB-GR|FUSION')
  })
})

describe('ejemplo 3: lista de códigos con guiones bajos', () => {
  const result = interpretRequest(example('variantes'))

  it('reconoce el modelo pese a los guiones bajos y deduce marca y familia', () => {
    expect(result.fields.marca).toMatchObject({ value: 'UBX', status: STATUS.DEDUCED })
    expect(result.fields.marca.reason).toContain('FF313')
    expect(result.fields.familia).toMatchObject({ value: 'CASCOS', status: STATUS.DEDUCED })
  })

  it('separa las 6 variantes, con los guiones bajos como espacios', () => {
    expect(result.variants).toEqual([
      'FF313 AVA ARCANO GLOSS BLACK BLUE',
      'FF313 AVA ARCANO GLOSS BLACK PINK',
      'FF313 AVA ARCANO GLOSS BLACK RED',
      'FF313 AVA ARCANO GLOSS BLACK WHITE',
      'FF313 AVA ARCANO GLOSS BLACK GRADIENT PINK PURPLE',
      'FF313 AVA ARCANO GLOSS BLACK GRADIENT RED YELLOW',
    ])
  })

  it('no elige la descripción ni el genérico, y no inventa talles', () => {
    expect(result.fields.descripcion).toMatchObject({ value: '', status: STATUS.MISSING })
    expect(result.fields.descripcion.reason).toContain('6 variantes')
    expect(result.candidates.map((item) => item.codigo).sort()).toEqual(['UBX010313AB-GR', 'UBX010313AB-SD'])
    expect(result.fields.generico.value).toBe('')
    expect(result.rows).toEqual([])
    expect(result.empty).toBe(false)
  })

  it('con una sola variante la descripción queda deducida', () => {
    const single = interpretRequest('Podés armar FF313_AVA_ARCANO_GLOSS_BLACK_RED?')
    expect(single.variants).toEqual([])
    const listed = interpretRequest('FF313_AVA_ARCANO_GLOSS_BLACK_RED')
    expect(listed.variants).toEqual(['FF313 AVA ARCANO GLOSS BLACK RED'])
    expect(listed.fields.descripcion).toMatchObject({ value: 'FF313 AVA ARCANO GLOSS BLACK RED', status: STATUS.DEDUCED })
  })

  it('no confunde los ejemplos anteriores con una lista de variantes', () => {
    expect(interpretRequest(example('mail')).variants).toEqual([])
    expect(interpretRequest(example('excel')).variants).toEqual([])
  })
})

describe('descripción contra la composición del SKU (URBAX)', () => {
  afterEach(() => resetAltas())
  const partsOf = (description) => Object.fromEntries(decomposeDescription('UBX', description).parts.map((part) => [part.id, part]))

  it('los 6 colores del mail existen en la tabla, respetando el orden de las palabras', () => {
    const codes = interpretRequest(example('variantes')).variants.map((variant) => {
      const parts = partsOf(variant)
      expect(parts.calota).toMatchObject({ status: COMPONENT_STATUS.FOUND, code: '313', name: 'AVA' })
      expect(parts.grafica).toMatchObject({ status: COMPONENT_STATUS.FOUND, code: '22', name: 'ARCANO' })
      return parts.color.code
    })
    // GLOSS BLACK RED es el color 50 (no BLACK RED GLOSS ni RED BLACK GLOSS); GLOSS BLACK WHITE = BLACK WHITE GLOSS.
    expect(codes).toEqual(['I7', 'E8', '50', '84', 'I9', 'I0'])
  })

  it('deduce la tipología por los SKU que ya existen con esa calota, sin mezclar repuestos', () => {
    expect(partsOf('FF313 AVA ARCANO GLOSS BLACK BLUE').tipologia).toMatchObject({ status: COMPONENT_STATUS.DEDUCED, code: '10' })
  })

  it('lo que no existe queda como nuevo, con el alta ya preparada, y nada se inventa', () => {
    const parts = partsOf('FF999 NOVA ZETA GLOSS BLACK LIME')
    expect(parts.calota).toMatchObject({ status: COMPONENT_STATUS.NEW, code: '', create: { targetId: 'calota-UBX', values: { codigo: '999', descripcion: 'NOVA' } } })
    expect(parts.grafica).toMatchObject({ status: COMPONENT_STATUS.NEW, create: { targetId: 'grafica-UBX', values: { descripcion: 'ZETA' } } })
    expect(parts.color).toMatchObject({ status: COMPONENT_STATUS.NEW, create: { targetId: 'color-cascos', values: { descripcion: 'BLACK LIME GLOSS' } } })
    expect(parts.tipologia.status).toBe(COMPONENT_STATUS.AMBIGUOUS)
    expect(selectionsFromParts(Object.values(parts))).toEqual({})
  })

  it('al crear las altas, la descripción se resuelve y queda pendiente de aceptar', () => {
    createAlta('calota-UBX', { codigo: '999', descripcion: 'NOVA' })
    createAlta('grafica-UBX', { codigo: 'ZZ', descripcion: 'ZETA' })
    const { entry } = createAlta('color-cascos', { codigo: 'ZY', descripcion: 'BLACK LIME GLOSS', abreviatura: 'BK/LM GS' })
    const parts = partsOf('FF999 NOVA ZETA GLOSS BLACK LIME')
    expect(parts.calota).toMatchObject({ status: COMPONENT_STATUS.FOUND, code: '999' })
    expect(parts.grafica).toMatchObject({ status: COMPONENT_STATUS.FOUND, code: 'ZZ' })
    expect(parts.color).toMatchObject({ status: COMPONENT_STATUS.FOUND, code: 'ZY', alta: entry.id })
    acceptAltas([entry.id])
  })

  it('con varias tipologías posibles, la elección del usuario se aplica', () => {
    const { parts } = decomposeDescription('UBX', 'FF999 NOVA ZETA GLOSS BLACK LIME')
    const tipologia = applyChoices(parts, { tipologia: '11' }).find((part) => part.id === 'tipologia')
    expect(tipologia).toMatchObject({ status: COMPONENT_STATUS.FOUND, code: '11' })
  })

  it('marcas sin calota (GUD) o desconocidas no se descomponen', () => {
    expect(decomposeDescription('GUD', 'FF313 AVA ARCANO GLOSS BLACK BLUE').supported).toBe(false)
    expect(decomposeDescription('LS2', 'FF313 AVA ARCANO GLOSS BLACK BLUE').supported).toBe(false)
  })

  it('carga en el motor de URBAX los códigos de la variante elegida y arma el SKU', () => {
    const draft = interpretRequest(example('variantes'))
    draft.fields.descripcion = { value: draft.variants[2], status: STATUS.DETECTED, reason: '' }
    draft.fields.generico = { value: 'UBX010313AB-GR', status: STATUS.EDITED, reason: '' }
    draft.rows = [{ talle: { value: 'M' }, barras: { value: '' }, ean: { value: '' }, codigoProveedor: { value: '' }, unresolved: [] }]
    const load = toScreenLoad(draft)
    expect(load).toMatchObject({ ok: true, brandId: 'UBX', target: 'engine' })
    expect(load.payload.selections).toEqual({ tipologia: '10', calota: '313', grafica: '22', color: '50' })
    const proposal = buildEngineProposal(ENGINES.cascosUBX, { selections: load.payload.selections, sizes: load.payload.sizes })
    expect(proposal.rows[0].sku).toBe('UBX1031322' + '50.M')
  })
})

describe('encabezados', () => {
  it('reconoce variaciones de mayúsculas, acentos y abreviaturas', () => {
    expect(headerField('Cód. de barras')).toBe('barras')
    expect(headerField('CODIGO DE BARRAS')).toBe('barras')
    expect(headerField('barras')).toBe('barras')
    expect(headerField('Descripción')).toBe('descripcion')
    expect(headerField('Tipología')).toBe('tipologia')
    expect(headerField('ean ls2')).toBe('ean')
    expect(headerField('Marc')).toBe('marca')
    expect(headerField('Modelo Variante')).toBe('variante')
    expect(headerField('SKU LS2')).toBe('sku')
    expect(headerField('Código Proveedor')).toBe('sku')
    expect(headerField('Precio')).toBeNull()
  })

  it('lee una tabla con encabezados en minúsculas y con acentos', () => {
    const text = 'Marca\tFamilia\tCód. de barras\tEan\tTalle\tSku\nls2\tcascos\t9806002025011\t6937449162997\txxl\tLS2010806AB-GR'
    const result = interpretRequest(text)
    expect(result.fields.marca.value).toBe('LS2')
    expect(result.fields.generico.value).toBe('LS2010806AB-GR')
    expect(rowsOf(result)).toEqual([['2X', '9806002025011', '6937449162997']])
  })

  it('un valor de SKU que no es genérico se toma como código del proveedor', () => {
    const text = 'Marca\tFamilia\tEAN\tTalle\tSKU\nLS2\tINDUMENTARIA\t6923221198230\tS\t64240W0112S'
    const [row] = interpretRequest(text).rows
    expect(row.codigoProveedor).toMatchObject({ value: '64240W0112S', status: STATUS.DETECTED })
  })
})

describe('texto sin datos reconocibles', () => {
  it('no carga nada y lo avisa', () => {
    const result = interpretRequest('Hola Andrés, ¿cómo estás? Te escribo por el pedido de la semana pasada. Saludos.')
    expect(result.empty).toBe(true)
    expect(result.message).toMatch(/No se reconoció ningún dato/)
    expect(result.rows).toEqual([])
    expect(toScreenLoad(result).ok).toBe(false)
  })
})

describe('modelos con más de un genérico', () => {
  it('FF800 (STORM y STORM II, gráfica y sólido) muestra las opciones sin elegir', () => {
    const result = interpretRequest('Alta del FF800 STORM negro, talle M: EAN 6937449162997')
    expect(result.candidates.length).toBeGreaterThan(1)
    expect(result.fields.generico.value).toBe('')
    expect(result.fields.marca).toMatchObject({ value: 'LS2', status: STATUS.DEDUCED })
  })
})

describe('talles y números', () => {
  it('XXL se normaliza a 2X también en el mail', () => {
    const [row] = interpretRequest('FF806 FUSION\nXXL: barras 9806002025007 / EAN 6937449163031').rows
    expect(row.talle.value).toBe('2X')
    expect(row.talleRecibido).toBe('XXL')
  })

  it('rangos "S a 2X", "S-XL" y "S al 2X"', () => {
    expect(sizesFromRange('TALLES S A 2X', DEFAULT_CATALOGS).sizes).toEqual(['S', 'M', 'L', 'XL', '2X'])
    expect(sizesFromRange('TALLES S-XL', DEFAULT_CATALOGS).sizes).toEqual(['S', 'M', 'L', 'XL'])
    expect(sizesFromRange('DEL S AL 2X', DEFAULT_CATALOGS).sizes).toEqual(['S', 'M', 'L', 'XL', '2X'])
  })

  it('sin palabras clave, el dígito verificador GS1 decide y queda como deducido', () => {
    const result = classifyNumbers('S 9806002025011 6937449162997')
    expect(result.ean).toMatchObject({ value: '6937449162997', how: 'deduced' })
    expect(result.barras).toMatchObject({ value: '9806002025011', how: 'deduced' })
  })

  it('si no se puede decidir, los números quedan sin clasificar', () => {
    const result = classifyNumbers('S 6937449162997 6937449163000')
    expect(result.ean).toBeNull()
    expect(result.unresolved).toEqual(['6937449162997', '6937449163000'])
  })
})
