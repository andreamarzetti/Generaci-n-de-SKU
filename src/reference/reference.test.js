import { afterEach, describe, expect, it } from 'vitest'
import { ALL_GENERICOS, COLORS, REGLA_CASCOS } from '../data/realData'
import { BRANDS, ENGINES, genericosFor } from '../engines/engines'
import { buildEngineProposal } from '../engines/proposal'
import { interpretRequest } from '../parsing/interpret'
import { tangoDescription } from '../rules/descriptions'
import { acceptAltas, ALTA_STATUS, createAlta, getAlta, getAltas, pendingAltasUsed, removeAlta, resetAltas } from './store'
import { getTarget, suggestCode, validateAlta } from './targets'

afterEach(() => resetAltas())

const optionsOf = (engine, segmentId, selections = {}) => engine.segments.find((segment) => segment.id === segmentId).getOptions(selections)

describe('validación de altas', () => {
  it('exige los datos y el largo del código', () => {
    const { errors } = validateAlta(getTarget('grafica-UBX'), { codigo: '7', descripcion: '' })
    expect(errors.codigo).toMatch(/2 caracteres/)
    expect(errors.descripcion).toBeTruthy()
  })

  it('no deja repetir un código ni un nombre que ya existen', () => {
    const target = getTarget('grafica-UBX')
    expect(validateAlta(target, { codigo: '22', descripcion: 'OTRA' }).errors.codigo).toMatch(/ARCANO/)
    expect(validateAlta(target, { codigo: '80', descripcion: 'arcano' }).errors.descripcion).toMatch(/22/)
  })

  it('sugiere el siguiente código libre de la tabla', () => {
    const highest = Math.max(...REGLA_CASCOS.graficasURBAX.map((item) => Number(item.codigo)).filter(Number.isFinite))
    expect(suggestCode(getTarget('grafica-UBX'))).toBe(String(highest + 1).padStart(2, '0'))
  })
})

describe('alta de gráfica, color y genérico', () => {
  it('queda pendiente, aparece en el selector del motor y bloquea hasta aceptarla', () => {
    const created = createAlta('grafica-UBX', { codigo: '80', descripcion: 'Dragon' })
    expect(created.ok).toBe(true)
    expect(created.entry.status).toBe(ALTA_STATUS.PENDING)
    expect(optionsOf(ENGINES.cascosUBX, 'grafica').find((option) => option.code === '80')).toMatchObject({ label: 'DRAGON', alta: created.entry.id })

    const selections = { tipologia: '10', calota: '313', grafica: '80', color: '13' }
    expect(pendingAltasUsed(ENGINES.cascosUBX, selections).map((entry) => entry.id)).toEqual([created.entry.id])
    expect(pendingAltasUsed(ENGINES.cascosUBX, { ...selections, grafica: '22' })).toEqual([])

    const proposal = buildEngineProposal(ENGINES.cascosUBX, { selections, sizes: ['.M'] })
    expect(proposal.rows[0].sku).toBe('UBX103138013.M')

    acceptAltas([created.entry.id])
    expect(getAlta(created.entry.id).status).toBe(ALTA_STATUS.ACCEPTED)
    expect(pendingAltasUsed(ENGINES.cascosUBX, selections)).toEqual([])
  })

  it('un conjunto de colores nuevo sugiere su abreviatura con la tabla de colores', () => {
    const { suggest } = getTarget('color-cascos')
    expect(suggest({ descripcion: 'black blue gloss' })).toEqual({ abreviatura: 'BK/BL GS' })
  })

  it('un genérico nuevo aparece para la marca y familia', () => {
    const before = genericosFor(ENGINES.cascosUBX, { tipologia: '10' }).length
    const created = createAlta('generico', {
      marca: 'UBX',
      codigo: 'UBX010999AB-GR',
      familia: 'CASCOS',
      tipologia: 'INTEGRAL',
      modelo: 'PRUEBA',
      descripcion: 'FF999 PRUEBA AB GRAFICA',
    })
    expect(created.ok).toBe(true)
    const found = genericosFor(ENGINES.cascosUBX, { tipologia: '10' })
    expect(found).toHaveLength(before + 1)
    expect(pendingAltasUsed(ENGINES.cascosUBX, {}, found.find((item) => item.alta)).map((entry) => entry.id)).toEqual([created.entry.id])
  })

  it('un color de LS2 nuevo se usa en la descripción Tango', () => {
    expect(tangoDescription('FF1 LILAC GLOSS', 'S').text).toBe('FF1 LILAC GS S')
    createAlta('color-LS2', { ingles: 'Lilac', abreviatura: 'LIL', espanol: 'Lila' })
    expect(tangoDescription('FF1 LILAC GLOSS', 'S').text).toBe('FF1 LIL GS S')
  })

  it('quitar un alta pendiente la saca del catálogo', () => {
    const before = REGLA_CASCOS.graficasURBAX.length
    const { entry } = createAlta('grafica-UBX', { codigo: '80', descripcion: 'DRAGON' })
    expect(REGLA_CASCOS.graficasURBAX).toHaveLength(before + 1)
    expect(removeAlta(entry.id)).toEqual({ ok: true })
    expect(REGLA_CASCOS.graficasURBAX).toHaveLength(before)
    expect(getAltas()).toHaveLength(0)
  })

  it('una alta aceptada no se puede quitar desde la herramienta', () => {
    const { entry } = createAlta('grafica-UBX', { codigo: '80', descripcion: 'DRAGON' })
    acceptAltas([entry.id])
    expect(removeAlta(entry.id).ok).toBe(false)
  })
})

describe('marca nueva', () => {
  it('de cascos: aparece en la lista, arma SKU con sus propias calotas y gráficas y se reconoce en un mail', () => {
    const total = BRANDS.length
    const brand = createAlta('marca', { codigo: 'XYZ', descripcion: 'Xyzmoto', plantilla: 'cascos' })
    expect(brand.ok).toBe(true)
    expect(BRANDS).toHaveLength(total + 1)
    const engine = BRANDS.find((item) => item.id === 'XYZ').lines[0].engine

    expect(optionsOf(engine, 'calota')).toEqual([])
    expect(createAlta('calota-XYZ', { codigo: '101', descripcion: 'NOVA' }).ok).toBe(true)
    expect(createAlta('grafica-XYZ', { codigo: '01', descripcion: 'SIN GRAFICA' }).ok).toBe(true)

    const proposal = buildEngineProposal(engine, {
      selections: { tipologia: '10', calota: '101', grafica: '01', color: '13' },
      sizes: ['.M'],
    })
    expect(proposal.rows[0].sku).toBe('XYZ101010113.M')
    expect(pendingAltasUsed(engine, { tipologia: '10', calota: '101', grafica: '01', color: '13' })).toHaveLength(3)

    expect(interpretRequest('Alta de un casco XYZMOTO modelo FF101 NOVA, talle M').fields.marca.value).toBe('XYZ')
  })

  it('no se puede quitar una marca mientras otras altas dependen de ella', () => {
    const brand = createAlta('marca', { codigo: 'XYZ', descripcion: 'XYZMOTO', plantilla: 'cascos' })
    createAlta('calota-XYZ', { codigo: '101', descripcion: 'NOVA' })
    expect(removeAlta(brand.entry.id).ok).toBe(false)
  })

  it('de producto: usa las tablas de producto y su código no puede repetir una marca existente', () => {
    expect(validateAlta(getTarget('marca'), { codigo: 'MAC', descripcion: 'OTRA', plantilla: 'producto' }).errors.codigo).toMatch(/MAC/)
    expect(createAlta('marca', { codigo: 'PRD', descripcion: 'PRODUCTOS', plantilla: 'producto' }).ok).toBe(true)
    expect(ENGINES.productoPRD.segments.find((segment) => segment.id === 'marca').fixed).toBe('PRD')
  })
})

describe('reinicio', () => {
  it('devuelve los catálogos al estado original', () => {
    const totals = [ALL_GENERICOS.length, COLORS.length, BRANDS.length]
    createAlta('color-LS2', { ingles: 'LILAC', abreviatura: 'LIL', espanol: 'LILA' })
    createAlta('marca', { codigo: 'XYZ', descripcion: 'XYZMOTO', plantilla: 'ambos' })
    resetAltas()
    expect([ALL_GENERICOS.length, COLORS.length, BRANDS.length]).toEqual(totals)
    expect(ENGINES.cascosXYZ).toBeUndefined()
  })
})

describe('Excel de altas', () => {
  it('arma un resumen y una hoja por tipo, con las columnas de la tabla de origen', async () => {
    const { altasSheets, altasFileName } = await import('./exportReferences')
    createAlta('grafica-UBX', { codigo: '80', descripcion: 'DRAGON' })
    const colorCode = suggestCode(getTarget('color-cascos'))
    expect(createAlta('color-cascos', { codigo: colorCode, descripcion: 'BLACK PINK PURPLE GLOSS', abreviatura: 'BK/PK/PU GS', espanol: 'NEGRO ROSA VIOLETA BRILLO' }).ok).toBe(true)
    const sheets = altasSheets(getAltas())
    expect(sheets.map((sheet) => sheet.name)).toEqual(['Resumen', 'Graficas', 'Colores'])
    expect(sheets[0].rows).toHaveLength(2)
    expect(sheets[1].headers.slice(0, 4)).toEqual(['Hoja de CODIFICACION 2023', 'Ámbito', 'Código', 'Descripción'])
    expect(sheets[1].rows[0].slice(0, 4)).toEqual(['REFERENCIA CASCOS', 'Cascos URBAX', '80', 'DRAGON'])
    expect(sheets[2].rows[0].slice(2, 6)).toEqual([colorCode, 'BLACK PINK PURPLE GLOSS', 'BK/PK/PU GS', 'NEGRO ROSA VIOLETA BRILLO'])
    expect(sheets[1].rows[0].at(-3)).toBe('Pendiente de aceptar')
    expect(altasFileName(new Date('2026-09-30T12:00:00Z'))).toBe('Altas de referencia - 2026-09-30.xlsx')
  })
})

describe('tablas actuales', () => {
  it('listan lo que existe y las altas, y se exportan completas con su estado', async () => {
    const { listRecords } = await import('./targets')
    const { tableSheet } = await import('./exportReferences')
    const target = getTarget('grafica-UBX')
    const before = listRecords(target)
    expect(before.find(({ values }) => values.codigo === '22').values.descripcion).toBe('ARCANO')
    expect(before.every(({ alta }) => alta === null)).toBe(true)

    createAlta('grafica-UBX', { codigo: '80', descripcion: 'DRAGON' })
    const after = listRecords(target)
    expect(after).toHaveLength(before.length + 1)
    const sheet = tableSheet(target, after)
    expect(sheet.headers).toEqual(['Estado', 'Código (2)', 'Nombre'])
    expect(sheet.rows.find((row) => row[1] === '22')).toEqual(['Existente', '22', 'ARCANO'])
    expect(sheet.rows.at(-1)).toEqual(['Pendiente de aceptar', '80', 'DRAGON'])
  })

  it('las tablas con ámbito no muestran nada hasta elegirlo, y las marcas se listan con su tipo', async () => {
    const { listRecords } = await import('./targets')
    expect(listRecords(getTarget('tipologia-producto'))).toEqual([])
    expect(listRecords(getTarget('tipologia-producto'), { familia: 'RAINWEAR' }).length).toBeGreaterThan(0)
    const brands = listRecords(getTarget('marca')).map(({ values }) => [values.codigo, values.plantilla])
    expect(brands).toContainEqual(['UBX', 'cascos'])
    expect(brands).toContainEqual(['MAC', 'ambos'])
    expect(brands).toContainEqual(['LS2', 'propio'])
  })
})

describe('marcas y familias de cada tabla', () => {
  it('cada tabla aplica solo a las marcas y familias que corresponden', async () => {
    const { appliesTo } = await import('./targets')
    const applies = (id, filters) => appliesTo(getTarget(id), filters)
    expect(applies('calota-MAC', { brand: 'MAC' })).toBe(true)
    expect(applies('calota-MAC', { brand: 'NTO' })).toBe(false)
    expect(applies('calota-UBX', { brand: 'UBX', family: 'CASCOS' })).toBe(true)
    expect(applies('calota-UBX', { brand: 'UBX', family: 'GUANTES' })).toBe(false)
    expect(applies('tipologia-producto', { brand: 'NTO', family: 'RAINWEAR' })).toBe(true)
    expect(applies('tipologia-producto', { brand: 'UBX' })).toBe(false)
    expect(applies('articulo-producto-GUD', { brand: 'GUD', family: 'GUANTES' })).toBe(true)
    expect(applies('color-LS2', { brand: 'LS2' })).toBe(true)
    expect(applies('color-LS2', { brand: 'MAC' })).toBe(false)
    expect(applies('generico', { brand: 'LS2', family: 'GUANTES' })).toBe(true)
    expect(applies('marca', {})).toBe(true)
  })

  it('las marcas nuevas de cascos tienen sus propias tablas', async () => {
    const { appliesTo, getTargets } = await import('./targets')
    createAlta('marca', { codigo: 'XYZ', descripcion: 'XYZMOTO', plantilla: 'cascos' })
    const ofBrand = getTargets().filter((target) => appliesTo(target, { brand: 'XYZ' })).map((target) => target.id)
    expect(ofBrand).toEqual(expect.arrayContaining(['calota-XYZ', 'grafica-XYZ', 'color-cascos', 'tipologia-cascos', 'generico', 'marca']))
    expect(ofBrand).not.toContain('calota-UBX')
  })

  it('familia, género y origen de producto se listan y se pueden ampliar', async () => {
    const { listRecords } = await import('./targets')
    expect(listRecords(getTarget('familia-producto')).find(({ values }) => values.descripcion === 'RAINWEAR').values.codigo).toBe('3')
    expect(listRecords(getTarget('genero-producto')).map(({ values }) => values.descripcion)).toContain('HOMBRE')
    expect(listRecords(getTarget('origen-producto')).map(({ values }) => values.codigo)).toContain('I')
    expect(createAlta('genero-producto', { codigo: 'K', descripcion: 'KIDS', abreviatura: 'KD' }).ok).toBe(true)
    expect(listRecords(getTarget('genero-producto')).at(-1).values).toMatchObject({ codigo: 'K', descripcion: 'KIDS' })
  })
})
