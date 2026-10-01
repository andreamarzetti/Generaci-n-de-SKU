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
