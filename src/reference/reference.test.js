import { afterEach, describe, expect, it } from 'vitest'
import { FREE_DIGIT_RANGE } from '../rules/constants'
import { auditDuplicateCodes } from '../rules/audit'
import { ALL_GENERICOS, COLORS, REGLA_CASCOS } from '../data/realData'
import { BRANDS, ENGINES, genericosFor } from '../engines/engines'
import { buildEngineProposal } from '../engines/proposal'
import { interpretRequest } from '../parsing/interpret'
import { tangoDescription } from '../rules/descriptions'
import { acceptAltas, ALTA_STATUS, createAlta, getAlta, getAltas, pendingAltasUsed, removeAlta, resetAltas } from './store'
import { appliesTo, duplicateCases, exampleOf, getTarget, getTargets, kindsOfBrand, listRecords, repeatedCodes, searchRecords, suggestCode, tableColumns, targetsOfBrand, validateAlta } from './targets'

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

describe('alta de gráfica y color', () => {
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

describe('código sugerido: el siguiente al último de la tabla', () => {
  const lastCodes = (id, scope = {}) => getTarget(id).list(scope).map((item) => item.codigo)

  it('colores de cascos: la última fila dice J4, pero J5…K0 ya están usados (J4 y otros se repiten al final); se sugiere el primer libre, L1', () => {
    const codes = lastCodes('color-cascos')
    expect(codes.at(-1)).toBe('J4')
    // J5 … K0 existen en filas anteriores: sugerirlos duplicaría códigos.
    ;['J5', 'J9', 'K0'].forEach((code) => expect(codes).toContain(code))
    expect(suggestCode(getTarget('color-cascos'))).toBe('L1')
  })

  it('siempre parte de la última fila de la tabla y salta lo que ya está usado', () => {
    ;['color-producto', 'tipologia-cascos', 'grafica-MAC'].forEach((id) => {
      const target = getTarget(id)
      const codes = lastCodes(id)
      const last = codes.filter((code) => FREE_DIGIT_RANGE.includes(code)).at(-1)
      const suggestion = suggestCode(target)
      expect(codes).not.toContain(suggestion)
      // Es el primer libre a partir de la última fila: todo lo que hay entre medio está usado.
      FREE_DIGIT_RANGE.slice(FREE_DIGIT_RANGE.indexOf(last) + 1, FREE_DIGIT_RANGE.indexOf(suggestion)).forEach((code) => expect(codes).toContain(code))
    })
  })

  it('en todas las tablas de 2 caracteres la sugerencia está libre', () => {
    getTargets()
      .filter((target) => target.codeLength === 2)
      .forEach((target) => {
        const scope = target.id === 'tipologia-producto' ? { familia: 'RAINWEAR' } : target.id === 'articulo-producto' ? { linea: 'RAINSUIT MAC' } : {}
        const suggestion = suggestCode(target, scope)
        expect(suggestion).toMatch(/^[0-9A-Z]{2}$/)
        expect(lastCodes(target.id, scope)).not.toContain(suggestion)
      })
  })

  it('después de crear un alta, la sugerencia avanza al siguiente', () => {
    const first = suggestCode(getTarget('grafica-UBX'))
    expect(createAlta('grafica-UBX', { codigo: first, descripcion: 'PRUEBA UNO' }).ok).toBe(true)
    expect(suggestCode(getTarget('grafica-UBX'))).not.toBe(first)
  })

  it('las tablas de 3 caracteres (calotas) no sugieren nada: el código es el número del modelo', () => {
    expect(suggestCode(getTarget('calota-UBX'))).toBe('')
  })
})

describe('altas por marca', () => {
  const idsOf = (brand) => targetsOfBrand(brand).map((target) => target.id)

  it('NTO y 921 (solo producto) no tienen calotas ni gráficas, y sí tablas de producto', () => {
    ;['NTO', '921'].forEach((brand) => {
      expect(idsOf(brand)).toEqual(expect.arrayContaining(['color-producto', 'tipologia-producto', 'articulo-producto']))
      expect(idsOf(brand).some((id) => id.startsWith('calota') || id.startsWith('grafica'))).toBe(false)
    })
  })

  it('MAC y URBAX tienen calotas y gráficas propias; GUD, sus tablas de cascos y de producto', () => {
    expect(idsOf('MAC')).toEqual(expect.arrayContaining(['calota-MAC', 'grafica-MAC', 'color-cascos', 'color-producto']))
    expect(idsOf('UBX')).toEqual(expect.arrayContaining(['calota-UBX', 'grafica-UBX', 'color-cascos']))
    expect(idsOf('UBX')).not.toContain('color-producto')
    expect(idsOf('GUD')).toEqual(expect.arrayContaining(['grafica-GUD', 'color-cascos-GUD', 'color-producto-GUD', 'tipologia-cascos-GUD', 'articulo-producto-GUD']))
  })

  it('LS2 solo admite colores de la descripción', () => {
    expect(kindsOfBrand('LS2')).toEqual(['color'])
  })

  it('una marca nueva de cascos aparece con sus propias calotas y gráficas', () => {
    createAlta('marca', { codigo: 'XYZ', descripcion: 'XYZMOTO', plantilla: 'cascos' })
    expect(idsOf('XYZ')).toEqual(expect.arrayContaining(['calota-XYZ', 'grafica-XYZ', 'color-cascos']))
  })
})

describe('ejemplo real de cada campo', () => {
  it('es una fila que ya existe en la tabla, nunca una alta nueva', () => {
    createAlta('grafica-UBX', { codigo: '80', descripcion: 'DRAGON' })
    const example = exampleOf(getTarget('grafica-UBX'))
    expect(example.codigo).not.toBe('80')
    expect(example.descripcion).toBeTruthy()
  })

  it('completa todos los campos cuando hay una fila completa (colores: abreviatura y español)', () => {
    const example = exampleOf(getTarget('color-cascos'))
    expect(example.codigo).toBeTruthy()
    expect(example.descripcion).toBeTruthy()
    expect(example.abreviatura).toBeTruthy()
    expect(example.espanol).toBeTruthy()
  })

  it('en las tablas con ámbito usa el elegido o, si no, el primero', () => {
    const target = getTarget('tipologia-producto')
    expect(exampleOf(target, { familia: 'RAINWEAR' })).toMatchObject({ familia: 'RAINWEAR' })
    expect(exampleOf(target).familia).toBeTruthy()
    expect(exampleOf(target).codigo).toBeTruthy()
  })

  it('los genéricos son una tabla de solo consulta: se ven, pero no se cargan como alta', () => {
    const target = getTarget('generico')
    expect(target.readOnly).toBe(true)
    // Hay filas reales para consultar (y para mostrar de ejemplo), pero ninguna alta.
    expect(target.list().length).toBeGreaterThan(100)
    expect(target.list().some((item) => item.alta)).toBe(false)
  })

  it('marca nueva: muestra cómo está cargada una marca existente', () => {
    expect(exampleOf(getTarget('marca'))).toEqual({ codigo: 'UBX', descripcion: 'URBAX', plantilla: 'Cascos' })
  })

  it('no deja basura en las tablas al consultar un ejemplo sin ámbito elegido', () => {
    exampleOf(getTarget('tipologia-producto'))
    exampleOf(getTarget('articulo-producto'))
    expect(getTarget('tipologia-producto').list({ familia: 'RAINWEAR' }).length).toBeGreaterThan(0)
  })
})

describe('auditoría: códigos repetidos en las tablas de referencia', () => {
  it('detecta los colores que comparten código (I9, I0, J1…J4 se usan para dos colores)', () => {
    const colors = auditDuplicateCodes().find((table) => table.tabla.startsWith('Colores de cascos'))
    const repeated = Object.fromEntries(colors.repetidos.map((item) => [item.codigo, item.nombres]))
    expect(colors.repetidos.length).toBeGreaterThanOrEqual(20)
    expect(repeated.I9).toEqual(['BLACK WHITE GREEN GLOSS', 'BLACK GRADIENT PINK PURPLE GLOSS'])
    expect(repeated.J4).toEqual(['BLACK BORDÓ GLOSS', 'GOLD SILVER MATT'])
  })

  it('también en gráficas de URBAX y calotas de MAC, y no cuenta un mismo nombre repetido', () => {
    const tables = Object.fromEntries(auditDuplicateCodes().map((table) => [table.tabla, table.repetidos]))
    expect(tables['Gráficas de URBAX'].map((item) => item.codigo)).toEqual(['11', '19'])
    expect(tables['Calotas de MAC'][0]).toEqual({ codigo: '609', nombres: ['VIRTUS', 'VIRTUS II'] })
  })

  it('las altas nuevas de la herramienta no cuentan', () => {
    const before = auditDuplicateCodes().find((table) => table.tabla === 'Gráficas de URBAX').repetidos.length
    createAlta('grafica-UBX', { codigo: '80', descripcion: 'DRAGON' })
    expect(auditDuplicateCodes().find((table) => table.tabla === 'Gráficas de URBAX').repetidos).toHaveLength(before)
  })
})

describe('el código genérico no se carga como alta (se crea al generar el SKU)', () => {
  it('createAlta lo rechaza con el motivo y no agrega nada a los catálogos', () => {
    const before = getTarget('generico').list().length
    const result = createAlta('generico', {
      marca: 'UBX',
      codigo: 'UBX010999AB-GR',
      familia: 'CASCOS',
      tipologia: 'INTEGRAL',
      modelo: 'PRUEBA',
      descripcion: 'FF999 PRUEBA AB GRAFICA',
    })
    expect(result.ok).toBe(false)
    expect(result.errors._).toBe('Los códigos genéricos no se cargan como alta: se crean al generar el SKU (el genérico es el mismo SKU sin talle).')
    expect(getTarget('generico').list()).toHaveLength(before)
    expect(getAltas()).toHaveLength(0)
  })

  it('ninguna marca ofrece genéricos para dar de alta, ni la tabla se puede elegir como destino', () => {
    BRANDS.forEach((brand) => {
      expect(kindsOfBrand(brand.id)).not.toContain('generico')
      expect(targetsOfBrand(brand.id).some((target) => target.readOnly || target.kind === 'generico')).toBe(false)
    })
  })

  it('la tabla de genéricos se sigue pudiendo consultar y filtrar por marca y familia (explorador)', () => {
    const generics = getTargets().find((target) => target.id === 'generico')
    expect(appliesTo(generics, { brand: 'LS2', family: 'GUANTES' })).toBe(true)
    expect(listRecords(generics).length).toBeGreaterThan(100)
  })

  it('una alta de genérico guardada de antes se descarta al cargar, sin romper las demás', async () => {
    const { vi } = await import('vitest')
    const stored = [
      { id: 'alta-vieja-1', target: 'generico', values: { marca: 'UBX', codigo: 'UBX010999AB-GR', modelo: 'PRUEBA' }, status: 'pendiente', createdAt: '2026-09-30' },
      { id: 'alta-ok-2', target: 'grafica-UBX', values: { codigo: '80', descripcion: 'DRAGON' }, status: 'pendiente', createdAt: '2026-09-30' },
    ]
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(stored), setItem: () => {}, removeItem: () => {} })
    vi.resetModules()
    const fresh = await import('./store')
    expect(fresh.getAltas().map((alta) => alta.id)).toEqual(['alta-ok-2'])
    fresh.resetAltas()
    vi.unstubAllGlobals()
    vi.resetModules()
  })
})

describe('validación por campo (para marcar en vivo)', () => {
  const target = () => getTarget('grafica-UBX')

  it('un código que ya existe se detecta aunque falten otros datos', () => {
    const { errors } = validateAlta(target(), { codigo: '22', descripcion: '' })
    expect(errors.codigo).toBe('El código 22 ya lo usa ARCANO.')
    expect(errors.descripcion).toBe('Completá este dato.')
  })

  it('un nombre que ya existe se detecta aunque el código todavía no esté completo', () => {
    const { errors } = validateAlta(target(), { codigo: '', descripcion: 'arcano' })
    expect(errors.descripcion).toBe('Ya existe con el código 22.')
    expect(errors.codigo).toBe('Completá este dato.')
  })

  it('código y nombre repetidos se marcan cada uno en su campo', () => {
    const { errors } = validateAlta(target(), { codigo: '22', descripcion: 'ARCANO' })
    expect(Object.keys(errors).sort()).toEqual(['codigo', 'descripcion'])
  })

  it('un código mal formado se marca sin buscar repetidos', () => {
    const { errors } = validateAlta(target(), { codigo: '2', descripcion: 'NUEVA' })
    expect(errors.codigo).toMatch(/2 caracteres/)
    expect(errors.descripcion).toBeUndefined()
  })

  it('con todo libre no hay errores', () => {
    expect(validateAlta(target(), { codigo: '80', descripcion: 'DRAGON' }).errors).toEqual({})
  })

  it('marca nueva: código y nombre se controlan por separado', () => {
    const marca = getTarget('marca')
    expect(validateAlta(marca, { codigo: 'MAC', descripcion: 'OTRA', plantilla: 'cascos' }).errors).toEqual({ codigo: 'Ya existe la marca MAC (MAC).' })
    expect(validateAlta(marca, { codigo: 'ZZZ', descripcion: 'URBAX', plantilla: 'cascos' }).errors).toEqual({ descripcion: 'Ya existe la marca URBAX (UBX).' })
  })

  it('en tablas con ámbito, los repetidos se buscan recién cuando se eligió el ámbito', () => {
    const tipologias = getTarget('tipologia-producto')
    expect(validateAlta(tipologias, { codigo: '00', descripcion: 'RAINSUIT' }).errors.codigo).toBeUndefined()
    expect(validateAlta(tipologias, { familia: 'RAINWEAR', codigo: '00', descripcion: 'OTRA' }).errors.codigo).toMatch(/ya lo usa RAINSUIT/)
  })
})

describe('búsqueda de registros', () => {
  const records = () => listRecords(getTarget('calota-UBX'))
  const columns = () => tableColumns(getTarget('calota-UBX'))

  it('sin texto devuelve todo', () => {
    expect(searchRecords(records(), columns(), '')).toHaveLength(records().length)
    expect(searchRecords(records(), columns(), '   ')).toHaveLength(records().length)
  })

  it('busca por nombre o por código, sin distinguir mayúsculas', () => {
    expect(searchRecords(records(), columns(), 'ava').map(({ values }) => values.codigo)).toEqual(['313'])
    expect(searchRecords(records(), columns(), '911').map(({ values }) => values.descripcion)).toEqual(['ATLAS'])
  })

  it('un texto que no está en ninguna columna no devuelve nada', () => {
    expect(searchRecords(records(), columns(), 'zzzz')).toEqual([])
  })

  it('las altas nuevas también aparecen en la búsqueda, marcadas como nuevas', () => {
    createAlta('calota-UBX', { codigo: '777', descripcion: 'NUEVA' })
    const found = searchRecords(records(), columns(), 'nueva')
    expect(found).toHaveLength(1)
    expect(found[0].alta).toBeTruthy()
  })
})

describe('códigos repetidos en todas las tablas', () => {
  const casesOf = (filters) => duplicateCases(filters)
  const find = (cases, targetId, codigo) => cases.find((item) => item.targetId === targetId && item.codigo === codigo)

  it('encuentra los códigos que sirven a más de un nombre, con todos sus nombres', () => {
    const cases = casesOf()
    expect(find(cases, 'color-cascos', 'A0').nombres).toEqual(['RAINBOW', 'RED BLUE MATT'])
    expect(find(cases, 'color-cascos', 'I9').nombres).toEqual(['BLACK WHITE GREEN GLOSS', 'BLACK GRADIENT PINK PURPLE GLOSS'])
    expect(find(cases, 'grafica-UBX', '11').nombres).toEqual(['SOLID', 'RINO'])
    expect(find(cases, 'calota-MAC', '609').nombres).toEqual(['VIRTUS', 'VIRTUS II'])
    expect(find(cases, 'color-cascos', 'A0')).toMatchObject({ veces: 2, conflicto: true })
  })

  it('recorre todas las tablas, también las de ámbito (artículos por línea) y los genéricos', () => {
    const tables = new Set(casesOf().map((item) => item.targetId))
    expect([...tables]).toEqual(expect.arrayContaining(['color-cascos', 'grafica-UBX', 'calota-MAC', 'articulo-producto', 'tipologia-producto-GUD']))
    const article = casesOf().find((item) => item.targetId === 'articulo-producto' && item.ambito === 'CORDURA NTO')
    expect(article.nombres.length).toBeGreaterThan(1)
  })

  it('separa los que mezclan nombres distintos de los que son el mismo nombre repetido, y esos van primero', () => {
    const cases = casesOf()
    const firstSameName = cases.findIndex((item) => !item.conflicto)
    expect(firstSameName).toBeGreaterThan(0)
    expect(cases.slice(0, firstSameName).every((item) => item.conflicto)).toBe(true)
    expect(cases.slice(firstSameName).every((item) => !item.conflicto)).toBe(true)
    const same = cases.find((item) => item.targetId === 'tipologia-producto-GUD' && !item.conflicto)
    expect(same.nombres).toHaveLength(1)
    expect(same.veces).toBeGreaterThan(1)
  })

  it('se filtra por marca: URBAX solo ve sus tablas; NTO no ve las de cascos', () => {
    const ubx = casesOf({ brand: 'UBX' })
    expect([...new Set(ubx.map((item) => item.targetId))].sort()).toEqual(['color-cascos', 'grafica-UBX'])
    const nto = casesOf({ brand: 'NTO' })
    expect(nto.length).toBeGreaterThan(0)
    expect(nto.some((item) => ['color-cascos', 'grafica-UBX', 'calota-MAC'].includes(item.targetId))).toBe(false)
    expect(nto.some((item) => item.targetId === 'articulo-producto')).toBe(true)
  })

  it('se filtra por familia: solo quedan las tablas de esa familia', () => {
    const rainwear = casesOf({ family: 'RAINWEAR' })
    expect(rainwear.some((item) => item.targetId === 'color-cascos')).toBe(false)
    expect(rainwear.some((item) => item.targetId === 'articulo-producto')).toBe(true)
    // Una tipología de producto se mira dentro de su familia.
    expect(rainwear.filter((item) => item.targetId === 'tipologia-producto').every((item) => item.ambito === 'RAINWEAR')).toBe(true)
  })

  it('los códigos genéricos no entran: se crean al generar el SKU y no son datos de referencia', () => {
    ;[{}, { brand: 'LS2' }, { brand: 'MAC' }, { family: 'CASCOS' }].forEach((filters) => {
      expect(casesOf(filters).some((item) => item.targetId === 'generico' || item.kind === 'generico')).toBe(false)
    })
    // La tabla de genéricos tiene códigos asociados a más de un modelo, pero no se cuentan.
    expect(listRecords(getTarget('generico'))).not.toHaveLength(0)
  })

  it('los tipos de indumentaria que la hoja trae debajo de los colores no son colores ni cuentan como repetidos', () => {
    const colores = getTarget('color-producto')
    const nombres = listRecords(colores).map(({ values }) => values.descripcion)
    expect(nombres).not.toContain('JERSEY')
    expect(nombres).not.toContain('CALZA CORTA')
    expect(nombres).toContain('VERDE FLUO')
    expect(casesOf().some((item) => item.targetId === 'color-producto')).toBe(false)
  })

  it('el total sin genéricos ni tipos de indumentaria: 44 códigos repetidos (36 con nombres distintos)', () => {
    expect(casesOf()).toHaveLength(44)
    expect(casesOf().filter((item) => item.conflicto)).toHaveLength(36)
  })

  it('las altas nuevas de la herramienta no cuentan como repetidas', () => {
    const before = casesOf().length
    createAlta('grafica-UBX', { codigo: '80', descripcion: 'DRAGON' })
    expect(casesOf()).toHaveLength(before)
  })

  it('una marca sin códigos repetidos (solo producto sin colores propios, p. ej.) no rompe: devuelve lo que hay', () => {
    expect(Array.isArray(casesOf({ brand: '921' }))).toBe(true)
  })

  it('repeatedCodes marca los códigos de una tabla que figuran más de una vez', () => {
    const codes = repeatedCodes(listRecords(getTarget('color-cascos')))
    expect(codes.has('A0')).toBe(true)
    expect(codes.has('J4')).toBe(true)
    expect(codes.has('L1')).toBe(false)
    expect(repeatedCodes(listRecords(getTarget('grafica-UBX')))).toEqual(new Set(['11', '19']))
  })

  it('se exporta a Excel con tabla, ámbito, código, nombres y situación', async () => {
    const { duplicatesSheet, duplicatesFileName } = await import('./exportReferences')
    const sheet = duplicatesSheet(casesOf({ brand: 'UBX' }))
    expect(sheet.headers).toEqual(['Tabla', 'Ámbito', 'Código', 'Nombres que lo usan', 'Veces', 'Situación'])
    const row = sheet.rows.find((item) => item[2] === 'A0')
    expect(row).toEqual(['Conjunto de colores · Cascos MAC / URBAX', '', 'A0', 'RAINBOW / RED BLUE MATT', 2, 'Nombres distintos'])
    expect(duplicatesFileName(new Date('2026-10-02T12:00:00Z'))).toBe('Codigos repetidos - 2026-10-02.xlsx')
  })

  it('el Excel suma una hoja por tabla con los casos completos de cada código repetido', async () => {
    const { duplicateCasesSheets } = await import('./exportReferences')
    const cases = casesOf({ brand: 'UBX' })
    const sheets = duplicateCasesSheets(cases)
    const colors = sheets.find((sheet) => sheet.name.startsWith('Conjunto de colores'))
    expect(colors.headers[0]).toMatch(/^C[óo]digo/i)
    expect(colors.headers.at(-1)).toBe('Estado')
    const a0 = colors.rows.filter((row) => row[0] === 'A0')
    expect(a0).toHaveLength(2)
    expect(a0.map((row) => row[1]).sort()).toEqual(['RAINBOW', 'RED BLUE MATT'])
    expect(a0.every((row) => row.length === colors.headers.length && row.at(-1) === 'Existente')).toBe(true)
    expect(a0.some((row) => row.includes('RD/BL MT'))).toBe(true)
  })
})
