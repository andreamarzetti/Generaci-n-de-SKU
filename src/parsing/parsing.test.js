import { describe, expect, it } from 'vitest'
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
