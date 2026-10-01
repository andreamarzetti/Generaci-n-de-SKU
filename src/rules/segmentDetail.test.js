import { afterEach, describe, expect, it } from 'vitest'
import { ENGINES } from '../engines/engines'
import { buildBatchProposal, buildEngineProposal, engineRowSegments } from '../engines/proposal'
import { createAlta, resetAltas } from '../reference/store'
import { buildProposal, proposalSegments } from './buildProposal'
import { FAMILIES } from './families'

afterEach(() => resetAltas())

const detailsOf = (segments) => Object.fromEntries(segments.map((segment) => [segment.id, segment.detail]))
const SELECTIONS = { tipologia: '10', calota: '313', grafica: '22', color: 'I7' }

describe('detalle de cada parte del SKU (mensaje al pasar el mouse)', () => {
  it('motores: cada código dice qué es (10 → Tipología: FF SV)', () => {
    const proposal = buildEngineProposal(ENGINES.cascosUBX, { selections: SELECTIONS, sizes: ['.M'] })
    const details = detailsOf(proposal.segments)
    expect(details.marca).toEqual({ title: 'Marca', text: 'URBAX' })
    expect(details.tipologia).toMatchObject({ title: 'Tipología', text: 'FF SV' })
    expect(details.calota).toMatchObject({ title: 'Calota', text: 'AVA' })
    expect(details.grafica).toMatchObject({ title: 'Gráfica', text: 'ARCANO' })
    expect(details.color).toMatchObject({ title: 'Color', text: 'BLACK BLUE GLOSS' })
    expect(details.talle).toEqual({ title: 'Talle', text: 'M', plain: true })
  })

  it('un código que no está en la tabla queda sin descripción, y lo que falta elegir no tiene detalle', () => {
    const proposal = buildEngineProposal(ENGINES.cascosUBX, { selections: { tipologia: '10', calota: '313', grafica: 'ZZ' }, sizes: [] })
    const details = detailsOf(proposal.segments)
    expect(details.grafica).toMatchObject({ title: 'Gráfica', text: null })
    expect(details.color).toBeNull()
    expect(details.talle).toBeNull()
  })

  it('un dato nuevo (alta) se reconoce para avisar que falta aceptarlo', () => {
    const { entry } = createAlta('grafica-UBX', { codigo: '80', descripcion: 'DRAGON' })
    const proposal = buildEngineProposal(ENGINES.cascosUBX, { selections: { ...SELECTIONS, grafica: '80' }, sizes: ['.M'] })
    expect(detailsOf(proposal.segments).grafica).toMatchObject({ text: 'DRAGON', alta: entry.id })
  })

  it('producto: el artículo y el color también explican su código', () => {
    const proposal = buildEngineProposal(ENGINES.productoMAC, {
      selections: { origen: 'I', familia: '3', tipologia: '00', genero: '1', articulo: '01', color: '02' },
      sizes: ['.S'],
    })
    const details = detailsOf(proposal.segments)
    expect(details.origen).toMatchObject({ title: 'Origen', text: 'IMPORTADO' })
    expect(details.familia).toMatchObject({ title: 'Familia', text: 'RAINWEAR' })
    expect(details.tipologia).toMatchObject({ text: 'RAINSUIT' })
    expect(details.genero).toMatchObject({ text: 'HOMBRE' })
    expect(details.color).toMatchObject({ text: 'NEGRO' })
  })

  it('carga masiva: cada fila lleva el detalle de su variante y de su talle', () => {
    const variants = [
      { key: 'V1', descripcion: 'A', selections: SELECTIONS, sizes: null },
      { key: 'V2', descripcion: 'B', selections: { ...SELECTIONS, color: 'E8' }, sizes: ['.L'] },
    ]
    const proposal = buildBatchProposal(ENGINES.cascosUBX, { variants, curve: ['.S', '.M'] })
    const rows = engineRowSegments(proposal).map(({ segments }) => detailsOf(segments))
    expect(rows.map((row) => row.talle.text)).toEqual(['S', 'M', 'L'])
    expect(rows.map((row) => row.color.text)).toEqual(['BLACK BLUE GLOSS', 'BLACK BLUE GLOSS', 'BLACK PINK GLOSS'])
  })

  it('LS2: prefijo, 7 dígitos del código de barras, libres y talle', () => {
    const rowData = { S: { barras: '9806002025011' } }
    const proposal = buildProposal(FAMILIES.cascos, { form: { descripcion: 'FF806 FUSION', talles: ['S'] }, rowData }, { freeDigitSources: [] })
    const details = detailsOf(proposalSegments(FAMILIES.cascos, proposal))
    expect(details.marca).toEqual({ title: 'Marca', text: 'LS2' })
    expect(details.barras.title).toBe('Código de barras')
    expect(details.barras.text).toContain('7 dígitos')
    expect(details.libres.text).toContain('01–99')
    expect(details.talle).toEqual({ title: 'Talle', text: 'S', plain: true })
  })

  it('LS2: si el talle se recibió con otro nombre (XXL), se aclara', () => {
    const proposal = buildProposal(FAMILIES.cascos, { form: { descripcion: 'FF806', talles: ['XXL'] }, rowData: { '2X': { barras: '9806002025007' } } }, { freeDigitSources: [] })
    expect(detailsOf(proposalSegments(FAMILIES.cascos, proposal)).talle.text).toBe('2X (recibido XXL)')
  })

  it('LS2 con código del proveedor: el detalle explica de dónde sale cada parte', () => {
    const proposal = buildProposal(FAMILIES.indumentaria, { form: { descripcion: 'CAMPERA', codigos: '64240W0112S' } })
    const details = detailsOf(proposalSegments(FAMILIES.indumentaria, proposal))
    expect(details.codigo.title).toBe('Código del proveedor')
    expect(details.talle.text).toBe('S')
  })
})
