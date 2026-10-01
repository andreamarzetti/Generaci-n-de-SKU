import { describe, expect, it } from 'vitest'
import {
  ALL_ARTICLES,
  COLORS,
  EXISTING_ARTICLES,
  GENERICOS,
  OFFICIAL_SIZES,
  REGLA_CASCOS,
  REGLA_CASCOS_GUD,
} from '../data/realData'
import { auditLegacySizes, auditStructureAnomalies } from '../rules/audit'
import { ARTICLE_SEQUENCE, nextArticleCode, usedArticleCodes } from './correlative'
import { BRANDS, decomposeSku, ENGINES, genericosFor, prefixBeforeArticle } from './engines'
import { buildEngineProposal, validateEngineRows } from './proposal'

const skusFromSheet = (...sheets) => ALL_ARTICLES.filter((article) => sheets.includes(article.hoja)).map((a) => a.sku)
const ANOMALIES = ['IMAC8010102.S', 'IMAC804101022X', 'IMAC804101023X', 'IMAC804101024X', 'IMAC804101025X', 'LS28002025.00']

describe('datos de LS2 dentro del archivo de todas las marcas', () => {
  it('conserva los mismos volúmenes que el archivo anterior', () => {
    expect(EXISTING_ARTICLES).toHaveLength(311)
    expect(GENERICOS).toHaveLength(252)
    expect(OFFICIAL_SIZES).toEqual(['2S', 'XS', 'S', 'M', 'L', 'XL', '2X', '3X', '4X', '5X', 'TU'])
    expect(COLORS).toHaveLength(30)
  })
})

describe('b) cascos MAC / URBAX', () => {
  const skus = skusFromSheet('CASCOS MAC-URX')

  it('los 2.515 SKUs reales se descomponen con el motor', () => {
    expect(skus).toHaveLength(2515)
    const failures = skus.filter((sku) => !decomposeSku(sku.startsWith('UBX') ? ENGINES.cascosUBX : ENGINES.cascosMAC, sku))
    expect(failures).toEqual([])
  })

  it('descompone el ejemplo real MAC939070001.TU', () => {
    expect(decomposeSku(ENGINES.cascosMAC, 'MAC939070001.TU')).toEqual({
      values: { marca: 'MAC', tipologia: '93', calota: '907', grafica: '00', color: '01' },
      size: '.TU',
    })
  })

  it('arma el mismo SKU desde los catálogos', () => {
    const proposal = buildEngineProposal(ENGINES.cascosMAC, {
      selections: { tipologia: '93', calota: '907', grafica: '00', color: '01' },
      sizes: ['.TU'],
    })
    expect(proposal.rows[0].sku).toBe('MAC939070001.TU')
    expect(REGLA_CASCOS.calotasMAC.some((calota) => calota.codigo === '907')).toBe(true)
  })

  it('no ofrece el talle viejo .XX al generar', () => {
    expect(ENGINES.cascosMAC.sizes.map((size) => size.code)).not.toContain('.XX')
  })

  it('genérico: CASCOS en tipologías de casco y REPUESTOS en el resto', () => {
    expect(ENGINES.cascosMAC.genericFamily({ tipologia: '10' })).toBe('CASCOS')
    expect(ENGINES.cascosMAC.genericFamily({ tipologia: '20' })).toBe('CASCOS')
    expect(ENGINES.cascosMAC.genericFamily({ tipologia: '93' })).toBe('REPUESTOS')
    expect(genericosFor(ENGINES.cascosMAC, { tipologia: '10' }).every((g) => g.marca === 'MAC' && g.familia === 'CASCOS')).toBe(true)
  })
})

describe('c) producto MAC / NTO', () => {
  const productEngineFor = (sku) => (sku.includes('GUD') ? ENGINES.productoGUD : sku.includes('NTO') ? ENGINES.productoNTO : ENGINES.productoMAC)
  const skus = skusFromSheet('PROD. MAC', 'PROD. NTO', 'PROD. GUD')

  it('975 de los 981 SKUs de producto respetan la estructura; los 6 restantes son los anómalos', () => {
    expect(skus).toHaveLength(981)
    const failures = skus.filter((sku) => !decomposeSku(productEngineFor(sku), sku))
    expect(skus.length - failures.length).toBe(975)
    expect(failures.sort()).toEqual([...ANOMALIES].sort())
  })

  it('descompone el ejemplo real IMAC30010102.S', () => {
    expect(decomposeSku(ENGINES.productoMAC, 'IMAC30010102.S')).toEqual({
      values: { origen: 'I', marca: 'MAC', familia: '3', tipologia: '00', genero: '1', articulo: '01', color: '02' },
      size: '.S',
    })
  })

  it('acepta productos sin talle (INTO80210202)', () => {
    expect(decomposeSku(ENGINES.productoNTO, 'INTO80210202')).toMatchObject({ size: '' })
  })

  it('calzado con punto', () => {
    expect(ENGINES.productoNTO.sizes.map((size) => size.code)).toContain('.40')
  })
})

describe('d) producto GUD', () => {
  it('los 288 SKUs reales se descomponen con el motor', () => {
    const skus = skusFromSheet('PROD. GUD')
    expect(skus).toHaveLength(288)
    expect(skus.filter((sku) => !decomposeSku(ENGINES.productoGUD, sku))).toEqual([])
  })
})

describe('e) cascos GUD', () => {
  it('los 27 SKUs reales se descomponen con el motor', () => {
    const skus = skusFromSheet('CASCOS GUD')
    expect(skus).toHaveLength(27)
    expect(skus.filter((sku) => !decomposeSku(ENGINES.cascosGUD, sku))).toEqual([])
  })

  it('descompone el ejemplo real GUD92030102.S', () => {
    expect(decomposeSku(ENGINES.cascosGUD, 'GUD92030102.S')).toEqual({
      values: { marca: 'GUD', tipologia: '92', grafica: '03', acabado: '01', color: '02' },
      size: '.S',
    })
    expect(REGLA_CASCOS_GUD.tipologias.some((tipologia) => tipologia.codigo === '92')).toBe(true)
  })
})

describe('f) 921', () => {
  it('los 12 SKUs reales se descomponen sin letra de origen', () => {
    const skus = ALL_ARTICLES.filter((article) => article.marca === '921').map((article) => article.sku)
    expect(skus).toHaveLength(12)
    expect(skus.filter((sku) => !decomposeSku(ENGINES.producto921, sku))).toEqual([])
    expect(decomposeSku(ENGINES.producto921, '92161110102.S').values).toMatchObject({ marca: '921', familia: '6' })
  })

  it('921 con curva de talles: el genérico es el SKU sin talle; sin curva, advierte que no hay genéricos cargados', () => {
    const selections = { familia: '6', tipologia: '11', genero: '1', articulo: '01', color: '02' }
    const proposal = buildEngineProposal(ENGINES.producto921, { selections, sizes: ['.S'] })
    expect(proposal.rows[0].sku).toBe('92161110102.S')
    const [result] = validateEngineRows({ engine: ENGINES.producto921, proposal })
    expect(result.checks.generico).toEqual({ status: 'ok', message: 'SKU genérico 92161110102' })
    // Ya existe en los datos reales: no bloquea, se avisa y se omite su creación.
    expect(result.checks.duplicate).toEqual({ status: 'warn', message: 'SKU ya existente: se omitirá su creación', omit: true })
    expect(result.omit).toBe(true)

    const single = buildEngineProposal(ENGINES.producto921, { selections, sizes: ['.TU'] })
    expect(validateEngineRows({ engine: ENGINES.producto921, proposal: single })[0].checks.generico.status).toBe('warn')
  })
})

describe('correlativo de artículo', () => {
  it('la secuencia es 01–99, AA–ZZ, 0A–9Z, A0–Z9', () => {
    expect(ARTICLE_SEQUENCE.slice(0, 2)).toEqual(['01', '02'])
    expect(ARTICLE_SEQUENCE[98]).toBe('99')
    expect(ARTICLE_SEQUENCE[99]).toBe('AA')
    expect(ARTICLE_SEQUENCE).toContain('0A')
    expect(ARTICLE_SEQUENCE.at(-1)).toBe('Z9')
  })

  it('sugiere el siguiente libre después del más alto usado', () => {
    expect(nextArticleCode(new Set(['01', '02', '05']))).toBe('06')
    expect(nextArticleCode(new Set(['99']))).toBe('AA')
    expect(nextArticleCode(new Set())).toBe('01')
  })

  it('con datos reales: el prefijo de IMAC30010102 ya usa 01 y 02', () => {
    const prefix = prefixBeforeArticle(ENGINES.productoMAC, { origen: 'I', familia: '3', tipologia: '00', genero: '1' })
    expect(prefix).toBe('IMAC3001')
    const used = usedArticleCodes(prefix, ALL_ARTICLES.map((article) => article.sku))
    expect(used.has('01')).toBe(true)
    expect(nextArticleCode(used)).not.toBe('01')
  })
})

describe('validaciones comunes', () => {
  it('un SKU existente de otra marca se avisa y se omite su creación', () => {
    const proposal = buildEngineProposal(ENGINES.cascosMAC, {
      selections: { tipologia: '93', calota: '907', grafica: '00', color: '01' },
      sizes: ['.TU'],
      descripcion: 'VISOR',
    })
    const [result] = validateEngineRows({ engine: ENGINES.cascosMAC, proposal, generico: { codigo: 'X' } })
    expect(result.checks.duplicate).toEqual({ status: 'warn', message: 'SKU ya existente: se omitirá su creación', omit: true })
  })

  it('EAN opcional: vacío no aplica; con dígito verificador inválido es error', () => {
    const proposal = buildEngineProposal(ENGINES.cascosGUD, {
      selections: { tipologia: '92', grafica: '03', acabado: '01', color: '00' },
      sizes: ['.S', '.M'],
    })
    const rowData = { '.M': { ean: '6937449162998' } }
    const [small, medium] = validateEngineRows({ engine: ENGINES.cascosGUD, proposal, rowData, generico: { codigo: 'X' } })
    expect(small.checks.ean.status).toBe('na')
    expect(medium.checks.ean).toEqual({ status: 'error', message: 'Dígito verificador inválido' })
  })

  it('sin curva de talles y sin genérico de la lista, en una marca con genéricos, es bloqueante', () => {
    const selections = { tipologia: '92', grafica: '03', acabado: '01', color: '00' }
    const single = buildEngineProposal(ENGINES.cascosGUD, { selections, sizes: ['.TU'] })
    const [result] = validateEngineRows({ engine: ENGINES.cascosGUD, proposal: single })
    expect(result.checks.generico).toEqual({ status: 'error', message: 'Sin código genérico' })

    // Con curva de talles no hace falta elegirlo: el genérico es el SKU sin talle.
    const curve = buildEngineProposal(ENGINES.cascosGUD, { selections, sizes: ['.S', '.M'] })
    const results = validateEngineRows({ engine: ENGINES.cascosGUD, proposal: curve })
    results.forEach((row) => expect(row.checks.generico).toEqual({ status: 'ok', message: 'SKU genérico GUD92030100' }))
  })

  it('la pantalla ofrece las 7 marcas en orden', () => {
    expect(BRANDS.map((brand) => brand.label)).toEqual(['LS2', 'MAC', 'URBAX', 'NTO', 'GUD', '921'])
  })
})

describe('auditoría', () => {
  it('detecta los 6 SKUs anómalos, con corrección cuando se puede', () => {
    const anomalies = auditStructureAnomalies()
    expect(anomalies.map((item) => item.sku).sort()).toEqual([...ANOMALIES].sort())
    const bySku = Object.fromEntries(anomalies.map((item) => [item.sku, item]))
    expect(bySku.IMAC804101022X).toMatchObject({ reason: 'Le falta el punto del talle', suggested: 'IMAC80410102.2X' })
    expect(bySku.IMAC804101025X.suggested).toBe('IMAC80410102.5X')
    expect(bySku['IMAC8010102.S']).toMatchObject({ reason: 'Le falta un dígito', suggested: null })
    expect(bySku['LS28002025.00']).toMatchObject({ reason: 'No respeta la estructura (fila de prueba)', suggested: null })
  })

  it('muestra los talles viejos .XX de cascos con su equivalente 2X', () => {
    const legacy = auditLegacySizes()
    expect(legacy.length).toBeGreaterThan(0)
    legacy.forEach((item) => expect(item.suggested.endsWith('.2X')).toBe(true))
  })
})
