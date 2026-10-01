import { describe, expect, it } from 'vitest'
import { buildEngineProposal, validateEngineRows } from '../engines/proposal'
import { ENGINES } from '../engines/engines'
import { parseBatch } from './batch'
import { buildProposal } from './buildProposal'
import { FAMILIES } from './families'
import { checkGenericExists, genericSkuOf } from './genericSku'
import { validateRows } from './validateRows'

const NO_USED = { freeDigitSources: [] }

describe('SKU genérico = el mismo SKU sin el talle', () => {
  it('quita el talle del SKU', () => {
    expect(genericSkuOf('LS2980600201.S')).toBe('LS2980600201')
    expect(genericSkuOf('LS2980600201.2X')).toBe('LS2980600201')
    expect(genericSkuOf('UBX103132250.XL')).toBe('UBX103132250')
    expect(genericSkuOf('LS2710800112.40')).toBe('LS2710800112')
  })

  it('sin curva de talles no hay genérico: sin talle o talle único', () => {
    expect(genericSkuOf('INTO80210202')).toBeNull()
    expect(genericSkuOf('LS28105057.TU')).toBeNull()
    expect(genericSkuOf(null)).toBeNull()
  })

  it('LS2 cascos (caso de Andrés): 5 talles dan un solo genérico, con la descripción sin talle', () => {
    const rowData = Object.fromEntries(
      [['S', '9806002025011'], ['M', '9806002025010'], ['L', '9806002025009'], ['XL', '9806002025008'], ['2X', '9806002025007']].map(([size, barras]) => [size, { barras }]),
    )
    const proposal = buildProposal(
      FAMILIES.cascos,
      { form: { descripcion: 'FF806 FUSION TECK LIGHT GRAY RED GLOSS', talles: ['S', 'M', 'L', 'XL', 'XXL'] }, rowData },
      NO_USED,
    )
    expect(proposal.rows).toHaveLength(5)
    expect(proposal.generics).toEqual([{ sku: 'LS2980600201', descripcion: 'FF806 FUSION TECK LIGHT GY/RD GS' }])
  })

  it('LS2 lote: cada variante tiene su genérico', () => {
    const text = ['FF806 FUSION BLACK GLOSS\t9806002025011\t\tS', 'FF806 FUSION BLACK GLOSS\t9806002025010\t\tM', 'FF806 FUSION WHITE GLOSS\t9806002025001\t\tS'].join('\n')
    const { rows } = parseBatch(text, FAMILIES.cascos)
    const rowData = Object.fromEntries(rows.map((row) => [row.key, { barras: row.barras }]))
    const proposal = buildProposal(FAMILIES.cascos, { batchRows: rows, rowData }, NO_USED)
    expect(proposal.generics.map((item) => item.sku)).toEqual(['LS2980600201', 'LS2980600202'])
  })

  it('LS2 otras familias: con curva de talles (indumentaria) sí, talle único o repuestos no', () => {
    const indumentaria = buildProposal(FAMILIES.indumentaria, { form: { descripcion: 'CAMPERA', codigos: '64240W0112S; 64240W0112M' } })
    expect(indumentaria.generics.map((item) => item.sku)).toEqual(['LS2642400112'])
    expect(buildProposal(FAMILIES.equipaje, { form: { descripcion: 'VALIJA', codigo: '8105057' } }).generics).toEqual([])
    expect(buildProposal(FAMILIES.repuestos, { form: { descripcion: 'TRABA', codigo: '800562VIO01' } }).generics).toEqual([])
  })

  it('motores: URBAX con varios talles da un genérico; sin talle o TU no', () => {
    const selections = { tipologia: '10', calota: '313', grafica: '22', color: '50' }
    const proposal = buildEngineProposal(ENGINES.cascosUBX, { selections, sizes: ['.S', '.M', '.XL'], descripcion: 'ff313 ava arcano gloss black blue' })
    expect(proposal.rows.map((row) => row.sku)).toEqual(['UBX103132250.S', 'UBX103132250.M', 'UBX103132250.XL'])
    expect(proposal.generics).toEqual([{ sku: 'UBX103132250', descripcion: 'FF313 AVA ARCANO GLOSS BLACK BLUE' }])

    const single = buildEngineProposal(ENGINES.cascosUBX, { selections, sizes: ['.TU'] })
    expect(single.generics).toEqual([])
  })

  it('si el genérico ya existe se avisa (se reutiliza), no se bloquea', () => {
    const existing = new Set(['LS2980600201'])
    expect(checkGenericExists('LS2980600202.S', { existingSkus: existing, sessionSkus: new Set() })).toBeNull()
    expect(checkGenericExists('LS2980600201.S', { existingSkus: existing, sessionSkus: new Set() })).toMatchObject({ status: 'warn' })
    expect(checkGenericExists('LS2980600201.S', { existingSkus: new Set(), sessionSkus: existing })).toMatchObject({ status: 'warn' })

    const rowData = { S: { barras: '9806002025011', ean: '6937449162997' } }
    const proposal = buildProposal(FAMILIES.cascos, { form: { descripcion: 'FF806', talles: ['S'] }, rowData }, NO_USED)
    const [result] = validateRows({ family: FAMILIES.cascos, proposal, rowData, existingSkus: existing, existingEans: new Map() })
    expect(result.checks.duplicate.status).toBe('warn')
    expect(result.checks.duplicate.message).toContain('LS2980600201')

    const engineProposal = buildEngineProposal(ENGINES.cascosUBX, {
      selections: { tipologia: '10', calota: '313', grafica: '22', color: '50' },
      sizes: ['.M'],
    })
    const [engineResult] = validateEngineRows({ engine: ENGINES.cascosUBX, proposal: engineProposal, existingSkus: new Set(['UBX103132250']), existingEans: new Map() })
    expect(engineResult.checks.duplicate.status).toBe('warn')
  })
})

describe('código genérico de una curva de talles (UBX1031322I7)', () => {
  const SELECTIONS = { tipologia: '10', calota: '313', grafica: '22', color: 'I7' }
  const CURVE = ['.XS', '.S', '.M', '.L', '.XL', '.2X']

  it('los SKU de la curva pertenecen al genérico UBX1031322I7: no hace falta elegir otro de la lista', () => {
    const proposal = buildEngineProposal(ENGINES.cascosUBX, { selections: SELECTIONS, sizes: CURVE })
    expect(proposal.rows.map((row) => row.sku)).toEqual([
      'UBX1031322I7.XS',
      'UBX1031322I7.S',
      'UBX1031322I7.M',
      'UBX1031322I7.L',
      'UBX1031322I7.XL',
      'UBX1031322I7.2X',
    ])
    expect(proposal.generics.map((item) => item.sku)).toEqual(['UBX1031322I7'])

    // Sin elegir nada de la lista (generico = null), ya no sale "Sin código genérico".
    const results = validateEngineRows({ engine: ENGINES.cascosUBX, proposal, generico: null, existingSkus: new Set(), existingEans: new Map() })
    results.forEach((row) => expect(row.checks.generico).toEqual({ status: 'ok', message: 'SKU genérico UBX1031322I7' }))
  })

  it('los talles que ya existen se omiten (no bloquean) y solo se crea el que falta', () => {
    const proposal = buildEngineProposal(ENGINES.cascosUBX, { selections: SELECTIONS, sizes: CURVE })
    // En los datos reales existen S, M, L, XL y 2X de esta variante; XS no.
    const results = validateEngineRows({ engine: ENGINES.cascosUBX, proposal, generico: null })
    const size = (row) => row.sku.split('.')[1]
    expect(Object.fromEntries(results.map((row) => [size(row), row.omit]))).toEqual({ XS: false, S: true, M: true, L: true, XL: true, '2X': true })
    expect(results[1].checks.duplicate).toEqual({ status: 'warn', message: 'SKU ya existente: se omitirá su creación', omit: true })
    // Nada bloquea: todas son advertencias, ninguna es error.
    expect(results.every((row) => row.status === 'warn')).toBe(true)
    // XS está libre, pero su genérico ya existe en la curva: se avisa que se reutiliza.
    expect(results[0].checks.duplicate.message).toContain('UBX1031322I7')
  })

  it('una fila que se omite no la bloquean otros controles (ej. un EAN ya asignado a ese SKU)', () => {
    const proposal = buildEngineProposal(ENGINES.cascosUBX, { selections: SELECTIONS, sizes: ['.S'] })
    // El EAN 6937449162997 figura en los datos reales asignado a otro SKU: sería error si la fila se creara.
    const [row] = validateEngineRows({
      engine: ENGINES.cascosUBX,
      proposal,
      generico: null,
      rowData: { '.S': { ean: '6937449162997' } },
      existingEans: new Map([['6937449162997', 'OTRO']]),
    })
    expect(row.checks.ean.status).toBe('error')
    expect(row.omit).toBe(true)
    expect(row.status).toBe('warn')
  })

  it('lo ya confirmado en la sesión también se omite, con su propio aviso', () => {
    const proposal = buildEngineProposal(ENGINES.cascosUBX, { selections: { ...SELECTIONS, color: '50' }, sizes: ['.M'] })
    const [row] = validateEngineRows({ engine: ENGINES.cascosUBX, proposal, generico: null, session: { skus: ['UBX103132250.M'], eans: [] } })
    expect(row.checks.duplicate).toEqual({ status: 'warn', message: 'SKU ya confirmado en esta sesión: se omitirá su creación', omit: true })
  })

  it('repetido dentro del mismo lote sigue siendo error (no es un SKU existente)', () => {
    const proposal = buildEngineProposal(ENGINES.cascosUBX, { selections: { ...SELECTIONS, color: '50' }, sizes: ['.M', '.M'] })
    const results = validateEngineRows({ engine: ENGINES.cascosUBX, proposal, generico: null })
    expect(results[0].checks.duplicate).toEqual({ status: 'error', message: 'Repetido dentro del lote' })
    expect(results[0].omit).toBe(false)
  })

  it('LS2: con curva de talles el genérico es el SKU sin talle; sin curva se pide el de la lista', () => {
    const rowData = { S: { barras: '9806002025011', ean: '6937449162997' } }
    const withCurve = buildProposal(FAMILIES.cascos, { form: { descripcion: 'FF806', talles: ['S'] }, rowData }, NO_USED)
    const [row] = validateRows({ family: FAMILIES.cascos, proposal: withCurve, rowData, generico: null, existingSkus: new Set(), existingEans: new Map() })
    expect(row.checks.generico).toEqual({ status: 'ok', message: 'SKU genérico LS2980600201' })

    const single = buildProposal(FAMILIES.equipaje, { form: { descripcion: 'VALIJA', codigo: '8105057' } })
    const [singleRow] = validateRows({ family: FAMILIES.equipaje, proposal: single, rowData: {}, generico: null })
    expect(singleRow.checks.generico).toEqual({ status: 'error', message: 'Sin código genérico' })
  })

  it('el Excel y el resumen llevan el SKU genérico como código genérico y la clasificación aparte', async () => {
    const { xlsxRows, XLSX_COLUMNS, summaryTsv } = await import('../services/exportLote')
    const items = [
      { sku: 'UBX1031322I7', descTango: 'FF313 AVA ARCANO', ean: '', talle: '', generico: 'UBX1031322I7', clasificacion: 'UBX010313AB-GR', esGenerico: true },
      { sku: 'UBX1031322I7.XS', descTango: 'FF313 AVA ARCANO XS', ean: '', talle: 'XS', generico: 'UBX1031322I7', clasificacion: 'UBX010313AB-GR' },
    ]
    expect(XLSX_COLUMNS).toEqual(['SKU', 'Descripción', 'EAN', 'Código genérico', 'Talle', 'Precio', 'Clasificación'])
    expect(xlsxRows(items)[1]).toEqual(['UBX1031322I7.XS', 'FF313 AVA ARCANO XS', '', 'UBX1031322I7', 'XS', '', 'UBX010313AB-GR'])
    expect(summaryTsv(items).split('\n')[2]).toContain('UBX1031322I7\t')
  })
})

describe('LS2: SKU ya existente se omite', () => {
  it('un SKU que ya existe es advertencia (no bloquea) y se marca para omitir', () => {
    const rowData = {
      S: { barras: '9806002025011', ean: '6937449162997' },
      M: { barras: '9806002025010', ean: '6937449163000' },
    }
    const proposal = buildProposal(FAMILIES.cascos, { form: { descripcion: 'FF806', talles: ['S', 'M'] }, rowData }, NO_USED)
    const [small, medium] = validateRows({
      family: FAMILIES.cascos,
      proposal,
      rowData,
      generico: null,
      existingSkus: new Set(['LS2980600201.S']),
      existingEans: new Map(),
    })
    expect(small.omit).toBe(true)
    expect(small.checks.duplicate).toEqual({ status: 'warn', message: 'SKU ya existente: se omitirá su creación', omit: true })
    expect(small.status).toBe('warn')
    // El otro talle sí se crea; su genérico ya existe (por LS2980600201.S) y se reutiliza.
    expect(medium.omit).toBe(false)
    expect(medium.checks.duplicate.message).toContain('LS2980600201')
  })
})
