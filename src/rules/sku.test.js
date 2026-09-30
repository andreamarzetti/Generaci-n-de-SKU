import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '../data/examples'
import { EXISTING_ARTICLES, findGenerico } from '../data/realData'
import { isValidGtin } from '../utils/gtin'
import { auditLongSkus } from './audit'
import { parseBatch } from './batch'
import { buildProposal } from './buildProposal'
import { buildClassification } from './classification'
import { gs1Description, tangoDescription } from './descriptions'
import { FAMILIES } from './families'
import { freeDigitsExhaustedMessage, getFreeDigitOptions } from './freeDigits'
import { normalizeSize, splitFootwearCode, splitSupplierCodes } from './sizes'
import { checkBarcode, checkEan, validateRows } from './validateRows'
import { summaryTsv } from '../services/exportLote'

const cascos = FAMILIES.cascos
const NO_USED = { freeDigitSources: [] }
const GENERICO = { codigo: 'LS2010806AB-GR' }

const skuFromSupplierCode = (code) => {
  const [{ base, size }] = splitSupplierCodes([code])
  return { size, sku: `LS2${base}.${size.value}` }
}

function loadCascoExample(id) {
  return EXAMPLES.cascos.find((example) => example.id === id).build()
}

describe('talles', () => {
  it('103207082XXL: normaliza XXL a 2X y el SKU queda en 15 caracteres', () => {
    const { size, sku } = skuFromSupplierCode('103207082XXL')
    expect(size).toMatchObject({ raw: 'XXL', value: '2X', normalized: true })
    expect(sku).toBe('LS2103207082.2X')
    expect(sku).toHaveLength(15)
  })

  it('normaliza todas las variantes a la tabla oficial', () => {
    expect(normalizeSize('2XL').value).toBe('2X')
    expect(normalizeSize('XXX').value).toBe('3X')
    expect(normalizeSize('3XL').value).toBe('3X')
    expect(normalizeSize('4XL').value).toBe('4X')
    expect(normalizeSize('5XL').value).toBe('5X')
    expect(normalizeSize('M')).toMatchObject({ value: 'M', normalized: false })
    expect(normalizeSize('XXXXL').recognized).toBe(false)
  })

  it('resuelve talles ambiguos con la base que comparte el resto del modelo', () => {
    const parts = splitSupplierCodes(['64240W0112XL', '64240W01123XL', '64240W0112S'])
    expect(parts.map((part) => `${part.base}.${part.size.value}`)).toEqual([
      '642400112.XL',
      '642400112.3X',
      '642400112.S',
    ])
  })

  it('calzado: los 2 dígitos finales son el talle', () => {
    expect(splitFootwearCode('71080C011240')).toMatchObject({ base: '710800112', size: { value: '40' } })
  })
})

describe('armado por familia (casos reales)', () => {
  it('indumentaria: 64240W0112S → LS2642400112.S', () => {
    const proposal = buildProposal(FAMILIES.indumentaria, { form: { codigos: '64240W0112S' } })
    expect(proposal.rows[0].sku).toBe('LS2642400112.S')
  })

  it('repuestos: LS2 + código con letras, sin punto', () => {
    const proposal = buildProposal(FAMILIES.repuestos, { form: { codigo: '800562vio01' } })
    expect(proposal.rows[0].sku).toBe('LS2800562VIO01')
  })

  it('equipaje: termina en .TU', () => {
    const proposal = buildProposal(FAMILIES.equipaje, { form: { codigo: '8105057' } })
    expect(proposal.rows[0].sku).toBe('LS28105057.TU')
  })
})

describe('cascos: ejemplo nuevo del paso a paso del 21/09', () => {
  const { form, rowData } = loadCascoExample('nuevo')
  const proposal = buildProposal(cascos, { form, rowData })

  it('los 5 EAN del ejemplo son válidos y no existen en los datos reales', () => {
    const existing = new Set(EXISTING_ARTICLES.map((article) => article.ean))
    Object.values(rowData).forEach(({ ean }) => {
      expect(isValidGtin(ean)).toBe(true)
      expect(existing.has(ean)).toBe(false)
    })
  })

  it('el prefijo 9806002 tiene libre el 01', () => {
    expect(getFreeDigitOptions('9806002')[0]).toEqual({ value: '01', usedIn: null })
  })

  it('arma exactamente los SKUs que armó Andrés a mano', () => {
    expect(proposal.rows.map((row) => row.sku)).toEqual([
      'LS2980600201.S',
      'LS2980600201.M',
      'LS2980600201.L',
      'LS2980600201.XL',
      'LS2980600201.2X',
    ])
  })

  it('talle S: 14 caracteres, válido', () => {
    const results = validateRows({ family: cascos, proposal, rowData, generico: GENERICO })
    const small = results.find((row) => row.key === 'S')
    expect(small.sku).toHaveLength(14)
    expect(small.checks.length.status).toBe('ok')
    expect(small.checks.format.status).toBe('ok')
  })

  it('arma la descripción Tango de Andrés para el talle S', () => {
    expect(proposal.rows[0].tango.text).toBe('FF806 FUSION TECK LIGHT GY/RD GS S')
  })

  it('no tiene bloqueantes: se puede confirmar (advierte precio y descripción de más de 30)', () => {
    const results = validateRows({ family: cascos, proposal, rowData, generico: GENERICO })
    expect(results.every((row) => row.status !== 'error')).toBe(true)
    expect(results.every((row) => row.checks.price.status === 'warn')).toBe(true)
    expect(results[0].checks.description).toEqual({ status: 'warn', message: '34 caracteres · supera 30 (a validar)' })
  })
})

describe('descripciones', () => {
  it('"FF806 FUSION TECK LIGHT GRAY RED GLOSS" + S da exactamente la descripción de Andrés', () => {
    const result = tangoDescription('FF806 FUSION TECK LIGHT GRAY RED GLOSS', 'S')
    expect(result.text).toBe('FF806 FUSION TECK LIGHT GY/RD GS S')
    expect(result.length).toBe(34)
    expect(result.overLimit).toBe(true)
  })

  it('busca primero los colores más largos y convierte MATT/MATTE', () => {
    expect(tangoDescription('FF800 STORM LIGHT BLUE MATTE', 'M').text).toBe('FF800 STORM LBL MT M')
    expect(tangoDescription('OF562 BLACK MATT', 'L').text).toBe('OF562 BK MT L')
  })

  it('reemplaza el talle que trae la descripción por el normalizado', () => {
    expect(tangoDescription('FF808 ROAD BLACK XXL', '2X').text).toBe('FF808 ROAD BK 2X')
  })

  it('GS1: solo letras, sin talle ni números del modelo', () => {
    expect(gs1Description('FF806 FUSION TECK LIGHT GY/RD GS S', 'S')).toBe('FF FUSION TECK LIGHT GY RD GS')
  })
})

describe('EAN', () => {
  it('un EAN que ya existe en el JSON marca duplicado', () => {
    const result = checkEan('6958639485344')
    expect(result.status).toBe('error')
    expect(result.message).toContain('LS2103207082.S')
  })

  it('un EAN con dígito verificador inválido es error', () => {
    expect(checkEan('6937449162998')).toEqual({ status: 'error', message: 'Dígito verificador inválido' })
  })

  it('un EAN repetido dentro del lote es error', () => {
    expect(checkEan('6937449162997', { eanCounts: { '6937449162997': 2 } }).status).toBe('error')
  })
})

describe('código de barras', () => {
  it('con 6 dígitos es error', () => {
    expect(checkBarcode('980600', cascos, null)).toEqual({ status: 'error', message: 'Tiene 6 dígitos; mínimo 7' })
  })

  it('en cascos, un talle con otros 7 primeros dígitos es error', () => {
    expect(checkBarcode('9806003025011', cascos, '9806002').status).toBe('error')
  })

  it('fuera de cascos es opcional', () => {
    expect(checkBarcode('', FAMILIES.guantes, null).status).toBe('na')
  })
})

describe('dígitos libres', () => {
  it('si todos los del rango están ocupados, no se arma el SKU y se explica por qué', () => {
    const used = ['01', '02', '03', '04', '05', '06', '07', '08', '09'].map((pair) => `LS29999999${pair}.M`)
    const sources = [{ label: 'test', skus: used }]
    expect(getFreeDigitOptions('9999999', sources).every((option) => option.usedIn)).toBe(true)

    const rowData = { M: { barras: '9999999000001' } }
    const proposal = buildProposal(cascos, { form: { talles: ['M'] }, rowData }, { freeDigitSources: sources })
    expect(proposal.rows[0].sku).toBeNull()
    expect(proposal.issues).toContain(freeDigitsExhaustedMessage('9999999'))

    const [result] = validateRows({ family: cascos, proposal, rowData, generico: GENERICO })
    expect(result.checks.format).toEqual({ status: 'error', message: freeDigitsExhaustedMessage('9999999') })
  })

  it('lote: variantes con los mismos 7 dígitos reciben pares distintos y consecutivos', () => {
    const text = [
      'FF806 FUSION BLACK GLOSS\t9806002025011\t6937449162997\tS',
      'FF806 FUSION BLACK GLOSS\t9806002025010\t6937449163000\tM',
      'FF806 FUSION WHITE GLOSS\t9806002025001\t6937449163017\tS',
      'FF320 STREAM RED\t1032070000001\t6937449163024\tL',
    ].join('\n')
    const { rows } = parseBatch(text, cascos)
    const rowData = Object.fromEntries(rows.map((row) => [row.key, { barras: row.barras, ean: row.ean }]))
    const proposal = buildProposal(cascos, { batchRows: rows, rowData }, NO_USED)

    expect(proposal.groups.map((group) => [group.prefix, group.freeDigit])).toEqual([
      ['9806002', '01'],
      ['9806002', '02'],
      ['1032070', '01'],
    ])
    expect(proposal.rows.map((row) => row.sku)).toEqual([
      'LS2980600201.S',
      'LS2980600201.M',
      'LS2980600202.S',
      'LS2103207001.L',
    ])
  })

  it('lote: el par elegido a mano se respeta y el siguiente grupo toma otro libre', () => {
    const text = 'A BLACK\t9806002025011\t\tS\nA WHITE\t9806002025001\t\tS'
    const { rows } = parseBatch(text, cascos)
    const rowData = Object.fromEntries(rows.map((row) => [row.key, { barras: row.barras }]))
    const proposal = buildProposal(cascos, { batchRows: rows, rowData }, {
      freeDigitSources: [],
      freeDigitChoices: { '9806002|A BLACK': '05' },
    })
    expect(proposal.groups.map((group) => group.freeDigit)).toEqual(['05', '01'])
  })
})

describe('carga por lote', () => {
  it('detecta el encabezado y lee las 4 columnas de LS2', () => {
    const text = 'Descripción\tCódigo de barras\tEAN\tTalle\nFF806 FUSION TECK\t9806002025011\t6937449162997\tXXL'
    const { rows, hasHeader } = parseBatch(text, cascos)
    expect(hasHeader).toBe(true)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ line: 2, barras: '9806002025011', ean: '6937449162997', errors: [] })
    expect(rows[0].size).toMatchObject({ value: '2X', normalized: true })
  })

  it('marca filas incompletas', () => {
    const { rows } = parseBatch('FF806 FUSION\t9806002025011', cascos)
    expect(rows[0].errors[0]).toMatch(/Faltan columnas/)
  })

  it('indumentaria: sin código proveedor, error en la fila', () => {
    const { rows } = parseBatch('CAMPERA\t\t6923221198230\tS', FAMILIES.indumentaria)
    expect(rows[0].errors).toContain('Falta el código del proveedor (obligatorio para Indumentaria)')
  })

  it('usa el talle de la columna para separar el código (…01123XL con 3XL)', () => {
    const { rows } = parseBatch('CAMPERA\t\t6923221198230\t3XL\t64240W01123XL', FAMILIES.indumentaria)
    const proposal = buildProposal(FAMILIES.indumentaria, { batchRows: rows })
    expect(proposal.rows[0].sku).toBe('LS2642400112.3X')
  })

  it('error si el código no termina en el talle de la columna', () => {
    const { rows } = parseBatch('CAMPERA\t\t6923221198230\tM\t64240W0112S', FAMILIES.indumentaria)
    expect(rows[0].errors).toContain('El código 64240W0112S no termina en el talle M')
  })

  it('cascos ignora el código proveedor', () => {
    const { rows } = parseBatch('FF806\t9806002025011\t6937449162997\tS\tCUALQUIERA', cascos)
    expect(rows[0].errors).toEqual([])
  })

  it('lee la tabla pegada de un mail separada por ";" o "|"', () => {
    const conPuntoYComa = parseBatch('FF806 FUSION TECK; 9806002025011; 6937449162997; S', cascos)
    const conBarras = parseBatch('| FF806 FUSION TECK | 9806002025011 | 6937449162997 | S |', cascos)
    for (const { rows } of [conPuntoYComa, conBarras]) {
      expect(rows[0]).toMatchObject({ descripcion: 'FF806 FUSION TECK', barras: '9806002025011', ean: '6937449162997', errors: [] })
    }
  })

  it('lee columnas separadas por varios espacios e ignora las líneas de adorno', () => {
    const text = 'Descripción    Código de barras    EAN    Talle\n-----------------\nFF806 FUSION TECK    9806002025011    6937449162997    M'
    const { rows, hasHeader } = parseBatch(text, cascos)
    expect(hasHeader).toBe(true)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ barras: '9806002025011', ean: '6937449162997', size: { value: 'M' }, errors: [] })
  })

  it('con encabezado, las columnas pueden venir en otro orden', () => {
    const text = 'Talle\tEAN\tDescripción\tCódigo de barras\nL\t6937449162997\tFF806 FUSION\t9806002025011'
    const { rows } = parseBatch(text, cascos)
    expect(rows[0]).toMatchObject({ descripcion: 'FF806 FUSION', barras: '9806002025011', ean: '6937449162997', errors: [] })
    expect(rows[0].size).toMatchObject({ value: 'L' })
  })
})

describe('varios códigos separados por ";"', () => {
  it('indumentaria: cada ";" es un código y un SKU', () => {
    const proposal = buildProposal(FAMILIES.indumentaria, { form: { codigos: '64240W0112S; 64240W0112M;64240W0112L;' } })
    expect(proposal.rows.map((row) => row.sku)).toEqual(['LS2642400112.S', 'LS2642400112.M', 'LS2642400112.L'])
  })

  it('también acepta un código por línea', () => {
    const proposal = buildProposal(FAMILIES.indumentaria, { form: { codigos: '64240W0112S\n64240W0112M' } })
    expect(proposal.rows).toHaveLength(2)
  })

  it('repuestos: varios códigos en el mismo campo', () => {
    const proposal = buildProposal(FAMILIES.repuestos, { form: { codigo: '800562VIO01;800562VIO02' } })
    expect(proposal.rows.map((row) => row.sku)).toEqual(['LS2800562VIO01', 'LS2800562VIO02'])
  })

  it('un código repetido genera claves de fila distintas', () => {
    const proposal = buildProposal(FAMILIES.repuestos, { form: { codigo: '800562VIO01;800562VIO01' } })
    expect(proposal.rows.map((row) => row.key)).toEqual(['800562VIO01', '800562VIO01#2'])
  })
})

describe('salida', () => {
  it('clasificación en cascos: código + modelo desde la descripción del genérico', () => {
    const generico = findGenerico('LS2010800KP-GR|STORM')
    expect(buildClassification(cascos, generico)).toEqual(['IMPORTADO', 'LS2', 'CASCOS', 'INTEGRAL', 'FF800 STORM'])
  })

  it('clasificación en el resto: campo modelo', () => {
    const generico = findGenerico('LS220002-HM|ALBA')
    expect(buildClassification(FAMILIES.cordura, generico)).toEqual(['IMPORTADO', 'LS2', 'CORDURA', 'CAMPERA CORTA', 'ALBA'])
  })

  it('resumen para copiar con DUN pendiente', () => {
    const tsv = summaryTsv([{ sku: 'LS2980600201.S', descTango: 'FF806 FUSION TECK LIGHT GY/RD GS S', ean: '6937449162997', generico: 'LS2010806AB-GR' }])
    expect(tsv.split('\n')[1]).toBe('LS2980600201.S\tFF806 FUSION TECK LIGHT GY/RD GS S\t6937449162997\tLS2010806AB-GR\tPendiente (GS1)')
  })

  it('auditoría: 12 SKUs reales de más de 15, todos corregibles a 15 sin chocar', () => {
    const audit = auditLongSkus()
    expect(audit).toHaveLength(12)
    audit.forEach((item) => {
      expect(item.suggestedLength).toBe(15)
      expect(item.suggested.endsWith('.2X')).toBe(true)
      expect(item.suggestedExists).toBe(false)
    })
  })
})

describe('cascos: ejemplo con conflictos (FF808 ROAD)', () => {
  it('normaliza XXL→2X y 3XL→3X y bloquea por EAN duplicado', () => {
    const { form, rowData } = loadCascoExample('conflictos')
    expect(form.talles).toEqual(['S', 'M', 'L', 'XL', 'XXL', '3XL'])
    const proposal = buildProposal(cascos, { form, rowData })
    expect(proposal.rows.map((row) => row.label)).toEqual(['S', 'M', 'L', 'XL', '2X', '3X'])

    const results = validateRows({ family: cascos, proposal, rowData, generico: null })
    expect(results.every((row) => row.checks.ean.message.startsWith('Duplicado'))).toBe(true)
    expect(results.find((row) => row.key === '2X').checks.size.status).toBe('warn')
  })
})
