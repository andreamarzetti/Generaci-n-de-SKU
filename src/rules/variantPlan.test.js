import { afterEach, describe, expect, it } from 'vitest'
import { createAlta, resetAltas } from '../reference/store'
import { ENGINES } from '../engines/engines'
import { buildBatchProposal } from '../engines/proposal'
import { interpretRequest } from '../parsing/interpret'
import { PASTE_EXAMPLES } from '../parsing/examples'
import { toScreenLoad } from '../parsing/toScreen'
import { STATUS } from '../parsing/normalize'
import { buildProposal } from './buildProposal'
import { FAMILIES } from './families'
import { normalizeSize } from './sizes'
import { effectiveSizes, hasOwnSizes, ls2RowsFromPlan, toggleInOrder, variantsFromDescriptions } from './variantPlan'

const ORDER = ['.XS', '.S', '.M', '.L', '.XL']
const variant = (key, color, sizes = null) => ({
  key,
  descripcion: `FF313 AVA ARCANO GLOSS ${color}`,
  selections: { tipologia: '10', calota: '313', grafica: '22', color },
  sizes,
})

describe('curva de talles', () => {
  it('una variante usa la curva salvo que tenga talles propios', () => {
    expect(effectiveSizes({ sizes: null }, ['.S', '.M'])).toEqual(['.S', '.M'])
    expect(effectiveSizes({ sizes: ['.L'] }, ['.S', '.M'])).toEqual(['.L'])
    expect(hasOwnSizes({ sizes: null })).toBe(false)
    expect(hasOwnSizes({ sizes: [] })).toBe(true)
  })

  it('agrega y quita talles respetando el orden de la tabla', () => {
    expect(toggleInOrder(['.S', '.L'], '.M', ORDER)).toEqual(['.S', '.M', '.L'])
    expect(toggleInOrder(['.S', '.M', '.L'], '.M', ORDER)).toEqual(['.S', '.L'])
    expect(toggleInOrder([], '.XL', ORDER)).toEqual(['.XL'])
  })

  it('numera las variantes V1, V2…', () => {
    expect(variantsFromDescriptions(['A', 'B'])).toEqual([
      { key: 'V1', descripcion: 'A', sizes: null },
      { key: 'V2', descripcion: 'B', sizes: null },
    ])
  })
})

describe('propuesta de varias variantes (motores)', () => {
  const variants = [variant('V1', 'I7'), variant('V2', 'E8'), variant('V3', '50', ['.M'])]

  it('arma un SKU por variante y talle, con la curva y los talles propios', () => {
    const proposal = buildBatchProposal(ENGINES.cascosUBX, { variants, curve: ['.S', '.M'] })
    expect(proposal.rows.map((row) => row.sku)).toEqual([
      'UBX1031322I7.S',
      'UBX1031322I7.M',
      'UBX1031322E8.S',
      'UBX1031322E8.M',
      'UBX103132250.M',
    ])
    expect(proposal.rows.map((row) => row.key)).toEqual(['V1|.S', 'V1|.M', 'V2|.S', 'V2|.M', 'V3|.M'])
    expect(proposal.rows.at(-1)).toMatchObject({ variantKey: 'V3', variant: 'FF313 AVA ARCANO GLOSS 50' })
  })

  it('un genérico por variante, aunque tengan varios talles', () => {
    const proposal = buildBatchProposal(ENGINES.cascosUBX, { variants, curve: ['.S', '.M'] })
    expect(proposal.generics.map((item) => item.sku)).toEqual(['UBX1031322I7', 'UBX1031322E8', 'UBX103132250'])
  })

  it('cada fila lleva los segmentos de su variante', () => {
    const proposal = buildBatchProposal(ENGINES.cascosUBX, { variants, curve: ['.S'] })
    const color = (row) => row.segments.find((segment) => segment.id === 'color').value
    expect(proposal.rows.map(color)).toEqual(['I7', 'E8', '50'].slice(0, 2).concat('50'))
    expect(proposal.rows[0].segments.find((segment) => segment.id === 'talle').value).toBe('.S')
  })

  it('la descripción editada de una fila no se mezcla con las demás variantes', () => {
    const rowData = { 'V2|.M': { descripcion: 'MI DESCRIPCION', ean: '6937449162997' } }
    const proposal = buildBatchProposal(ENGINES.cascosUBX, { variants, curve: ['.M'], rowData })
    expect(proposal.rows.map((row) => row.descripcion)).toEqual([
      'FF313 AVA ARCANO GLOSS I7',
      'MI DESCRIPCION',
      'FF313 AVA ARCANO GLOSS 50',
    ])
  })

  it('avisa qué variante no tiene talles o le faltan datos', () => {
    const proposal = buildBatchProposal(ENGINES.cascosUBX, {
      variants: [variant('V1', 'I7', []), { ...variant('V2', 'E8'), selections: { tipologia: '10' } }],
      curve: ['.S'],
    })
    expect(proposal.issues).toEqual(expect.arrayContaining([expect.stringContaining('FF313 AVA ARCANO GLOSS I7: Elegí al menos un talle')]))
    expect(proposal.issues.some((issue) => issue.includes('E8: Falta elegir'))).toBe(true)
    expect(buildBatchProposal(ENGINES.cascosUBX, { variants: [], curve: [] }).issues).toEqual(['No hay variantes para cargar.'])
  })
})

describe('carga masiva de LS2 desde variantes', () => {
  it('una fila por variante y talle, con claves propias y sin código de barras todavía', () => {
    const plan = { variants: [{ key: 'V1', descripcion: 'FF806 FUSION BLACK GLOSS', sizes: null }, { key: 'V2', descripcion: 'FF806 FUSION WHITE GLOSS', sizes: ['XL'] }], curve: ['M', 'L'] }
    const rows = ls2RowsFromPlan(plan, normalizeSize)
    expect(rows.map((row) => row.key)).toEqual(['V1|M', 'V1|L', 'V2|XL'])
    expect(rows.map((row) => row.size.value)).toEqual(['M', 'L', 'XL'])
    expect(rows.every((row) => row.barras === '' && row.errors.length === 0)).toBe(true)
  })

  it('las filas arman SKU cuando se carga el código de barras de cada una', () => {
    const plan = { variants: [{ key: 'V1', descripcion: 'FF806 FUSION BLACK GLOSS', sizes: null }], curve: ['M', 'L'] }
    const rows = ls2RowsFromPlan(plan, normalizeSize)
    const rowData = { 'V1|M': { barras: '9806002025010' }, 'V1|L': { barras: '9806002025009' } }
    const proposal = buildProposal(FAMILIES.cascos, { batchRows: rows, rowData }, { freeDigitSources: [] })
    expect(proposal.rows.map((row) => row.sku)).toEqual(['LS2980600201.M', 'LS2980600201.L'])
    expect(proposal.generics.map((item) => item.sku)).toEqual(['LS2980600201'])
  })
})

describe('pasar de la revisión a la carga masiva', () => {
  afterEach(() => resetAltas())
  const example = () => interpretRequest(PASTE_EXAMPLES.find((item) => item.id === 'variantes').text)
  const selectAll = (draft) => ({ ...draft, selected: [...draft.variants] })

  it('con todas marcadas arma el lote del motor de URBAX con los códigos de cada variante', () => {
    const draft = { ...selectAll(example()), curve: ['S', 'M'] }
    draft.fields.generico = { value: 'UBX010313AB-GR', status: STATUS.EDITED, reason: '' }
    const load = toScreenLoad(draft)
    expect(load).toMatchObject({ ok: true, brandId: 'UBX', target: 'engine' })
    const { batch } = load.payload
    expect(batch.curve).toEqual(['.S', '.M'])
    expect(batch.variants.map((item) => item.key)).toEqual(['V1', 'V2', 'V3', 'V4', 'V5', 'V6'])
    expect(batch.variants.map((item) => item.selections.color)).toEqual(['I7', 'E8', '50', '84', 'I9', 'I0'])
    batch.variants.forEach((item) => expect(item.selections).toMatchObject({ tipologia: '10', calota: '313', grafica: '22' }))
    expect(load.payload.genericoKey).toBe('UBX|UBX010313AB-GR|AVA')
  })

  it('la curva sale de los talles de la tabla si no se eligió otra', () => {
    const draft = selectAll(example())
    draft.rows = [{ talle: { value: 'M' } }, { talle: { value: 'XL' } }]
    expect(toScreenLoad(draft).payload.batch.curve).toEqual(['.M', '.XL'])
  })

  it('con una sola marcada sigue la carga de siempre, sin lote', () => {
    const draft = example()
    draft.selected = [draft.variants[2]]
    draft.fields.descripcion = { value: draft.variants[2], status: STATUS.DETECTED, reason: '' }
    const load = toScreenLoad(draft)
    expect(load.ok).toBe(true)
    expect(load.payload.batch).toBeUndefined()
    expect(load.payload.selections.color).toBe('50')
  })

  it('si una variante tiene partes sin resolver, no se carga y dice cuál', () => {
    const draft = interpretRequest('FF313_AVA_ARCANO_GLOSS_BLACK_RED\nFF313_AVA_ZETANUEVA_GLOSS_BLACK_RED')
    const load = toScreenLoad(selectAll(draft))
    expect(load.ok).toBe(false)
    expect(load.reason).toContain('FF313 AVA ZETANUEVA GLOSS BLACK RED')
    expect(load.reason).toContain('gráfica')
  })

  it('las elecciones del usuario son por variante', () => {
    // Calota nueva sin SKU previos: la tipología queda ambigua (FF SV, FF DV, FF) y se elige en cada variante.
    createAlta('calota-UBX', { codigo: '999', descripcion: 'NOVA' })
    const draft = selectAll(interpretRequest('FF999_NOVA_ARCANO_GLOSS_BLACK_RED\nFF999_NOVA_ARCANO_GLOSS_BLACK_WHITE'))
    // La marca no se puede deducir de un modelo nuevo: la completa el usuario.
    draft.fields.marca = { value: 'UBX', status: STATUS.EDITED, reason: '' }
    draft.fields.familia = { value: 'CASCOS', status: STATUS.EDITED, reason: '' }
    expect(toScreenLoad(draft).ok).toBe(false)

    draft.choices = {
      'FF999 NOVA ARCANO GLOSS BLACK RED': { tipologia: '10' },
      'FF999 NOVA ARCANO GLOSS BLACK WHITE': { tipologia: '11' },
    }
    const { variants } = toScreenLoad(draft).payload.batch
    expect(variants.map((item) => item.selections.tipologia)).toEqual(['10', '11'])
    expect(variants.map((item) => item.selections.color)).toEqual(['50', '84'])
  })

  it('en LS2 solo se cargan juntas las de cascos', () => {
    const draft = selectAll(interpretRequest('FF806_FUSION_TECK_LIGHT_GRAY_RED_GLOSS\nFF806_FUSION_TECK_BLACK_GLOSS'))
    expect(draft.fields.marca.value).toBe('LS2')
    const load = toScreenLoad({ ...draft, curve: ['M', 'L'] })
    expect(load).toMatchObject({ ok: true, target: 'ls2' })
    expect(load.payload.plan.curve).toEqual(['M', 'L'])
    expect(load.payload.plan.variants).toHaveLength(2)

    const notHelmets = { ...draft, fields: { ...draft.fields, familia: { value: 'GUANTES', status: STATUS.EDITED, reason: '' } } }
    expect(toScreenLoad(notHelmets).ok).toBe(false)
  })
})
