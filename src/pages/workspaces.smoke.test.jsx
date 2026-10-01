// @vitest-environment jsdom
// Smoke test: monta las pantallas reales (con sus efectos) para detectar a tiempo
// errores de integración, como una propiedad obligatoria que un componente deja de recibir.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../App'
import { createAlta, getAltas, resetAltas } from '../reference/store'
import { BRANDS, ENGINES } from '../engines/engines'
import { PASTE_EXAMPLES } from '../parsing/examples'
import { interpretRequest } from '../parsing/interpret'
import { toScreenLoad } from '../parsing/toScreen'
import { EngineWorkspace } from './EngineWorkspace'
import { Ls2Workspace } from './Ls2Workspace'
import { SkuGeneratorPage } from './SkuGeneratorPage'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root
let container

function mount(element) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(element))
  return container
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  resetAltas()
})

const noop = () => {}
const engineLines = BRANDS.flatMap((brand) => (brand.lines ?? []).map((line) => ({ brand, line })))

describe('EngineWorkspace', () => {
  it.each(engineLines.map(({ brand, line }) => [`${brand.label} · ${line.label}`, brand, line]))(
    'monta %s sin romperse',
    (_, brand, line) => {
      const view = mount(<EngineWorkspace brand={brand} engine={line.engine} confirmedItems={[]} onConfirmed={noop} />)
      expect(view.textContent).toContain('Composición del SKU')
      expect(view.querySelector('[aria-label="Reglas aplicadas"]')).not.toBeNull()
    },
  )

  it('muestra los SKU cuando recibe datos (casco MAC)', () => {
    const brand = BRANDS.find((item) => item.id === 'MAC')
    const request = {
      nonce: 1,
      target: 'engine',
      engineId: ENGINES.cascosMAC.id,
      payload: {
        selections: { tipologia: '93', calota: '907', grafica: '00', color: '01' },
        sizes: ['.TU'],
        descripcion: 'VISOR',
        genericoKey: '',
        rowData: {},
      },
    }
    const view = mount(
      <EngineWorkspace brand={brand} engine={ENGINES.cascosMAC} confirmedItems={[]} onConfirmed={noop} loadRequest={request} />,
    )
    expect(view.textContent).toContain('MAC939070001.TU')
  })
})

describe('Ls2Workspace', () => {
  it('monta vacío sin romperse', () => {
    const view = mount(<Ls2Workspace brandField={null} />)
    expect(view.textContent).toContain('Composición del SKU')
    expect(view.textContent).toContain('Uno por uno')
    expect(view.textContent).toContain('Carga masiva')
  })

  it('muestra los SKU de Andrés al cargar el ejemplo 1 de "Pegar solicitud"', () => {
    const load = toScreenLoad(interpretRequest(PASTE_EXAMPLES[0].text))
    const view = mount(<Ls2Workspace brandField={null} loadRequest={{ ...load, nonce: 1 }} />)
    ;['LS2980600201.S', 'LS2980600201.M', 'LS2980600201.L', 'LS2980600201.XL', 'LS2980600201.2X'].forEach((sku) =>
      expect(view.textContent).toContain(sku),
    )
  })
})

describe('SkuGeneratorPage', () => {
  it('monta la página completa sin romperse', () => {
    const view = mount(<SkuGeneratorPage />)
    expect(view.textContent).toContain('Pegar solicitud')
    expect(view.textContent).toContain('Generación de SKU')
  })

  it('el ícono (i) abre el popup de formatos y se cierra con Escape', () => {
    const view = mount(<SkuGeneratorPage />)
    expect(view.querySelector('[role="dialog"]')).toBeNull()
    act(() => view.querySelector('.info-button').click())
    const dialog = view.querySelector('[role="dialog"]')
    expect(dialog.textContent).toContain('Filas de Excel')
    expect(dialog.textContent).toContain('Lista de códigos con guiones bajos')
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(view.querySelector('[role="dialog"]')).toBeNull()
  })

  it('la lista de códigos muestra las 6 variantes y deja elegir una', () => {
    const view = mount(<SkuGeneratorPage />)
    const example = PASTE_EXAMPLES.find((item) => item.id === 'variantes')
    const textarea = view.querySelector('textarea')
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(textarea, example.text)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => [...view.querySelectorAll('button')].find((b) => b.textContent.includes('Interpretar')).click())
    expect(view.querySelectorAll('.variants__item')).toHaveLength(6)
    const toggle = () => act(() => view.querySelectorAll('.variants__item button')[1].click())
    toggle()
    expect(view.querySelector('.variants__item--selected').textContent).toContain('FF313 AVA ARCANO GLOSS BLACK PINK')
    toggle()
    expect(view.querySelector('.variants__item--selected')).toBeNull()
  })

  describe('flujo por pasos', () => {
    const visiblePanel = (view) => view.querySelector('.wizard__panel:not([hidden])').getAttribute('aria-label')
    const button = (view, text) => [...view.querySelectorAll('button')].find((b) => b.textContent.includes(text))
    const stepButton = (view, number) => view.querySelectorAll('.process__step')[number - 1]

    it('empieza en el paso 1 y navega con Siguiente y Anterior', () => {
      const view = mount(<SkuGeneratorPage />)
      expect(visiblePanel(view)).toBe('Paso 1: Datos')
      expect(button(view, 'Anterior').disabled).toBe(true)
      act(() => button(view, 'Siguiente').click())
      expect(visiblePanel(view)).toBe('Paso 2: Propuesta')
      act(() => button(view, 'Siguiente').click())
      expect(visiblePanel(view)).toBe('Paso 3: Validar y confirmar')
      expect(button(view, 'Siguiente').disabled).toBe(true)
      act(() => button(view, 'Anterior').click())
      expect(visiblePanel(view)).toBe('Paso 2: Propuesta')
    })

    it('al hacer clic en un número va directo a ese paso', () => {
      const view = mount(<SkuGeneratorPage />)
      act(() => stepButton(view, 3).click())
      expect(visiblePanel(view)).toBe('Paso 3: Validar y confirmar')
      expect(stepButton(view, 3).getAttribute('aria-current')).toBe('step')
      act(() => stepButton(view, 1).click())
      expect(visiblePanel(view)).toBe('Paso 1: Datos')
    })

    it('las reglas y la auditoría están en un (i) de cada sección', () => {
      const view = mount(<SkuGeneratorPage />)
      const panel = (number) => view.querySelectorAll('.wizard__panel')[number - 1]
      expect(panel(1).querySelector('[aria-label="Reglas aplicadas"]')).not.toBeNull()
      expect(panel(2).querySelector('[aria-label="Reglas aplicadas"]')).not.toBeNull()
      expect(panel(3).querySelector('[aria-label="Auditoría de códigos existentes"]')).not.toBeNull()
      expect(view.querySelector('.rules')).toBeNull()

      act(() => panel(3).querySelector('.info-button').click())
      expect(view.querySelector('[role="dialog"]').textContent).toContain('SKUs de LS2 de más de 15 caracteres')
    })
  })

  it('no ofrece botones de "Pegar ejemplo"', () => {
    const view = mount(<SkuGeneratorPage />)
    expect(view.textContent).not.toContain('Pegar ejemplo')
  })
})

describe('altas de referencia', () => {
  const buttonWith = (view, text) => [...view.querySelectorAll('button')].find((b) => b.textContent.includes(text))
  const typeInto = (input, value) =>
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

  it('se crea desde la sección "Altas de referencia" y queda pendiente de aceptar', () => {
    const view = mount(<App />)
    act(() => [...view.querySelectorAll('.sidebar__link')].find((a) => a.textContent.includes('Altas de referencia')).click())
    expect(view.querySelector('.view:not([hidden]) h1').textContent).toBe('Altas de referencia')
    expect(buttonWith(view, 'Exportar a Excel').disabled).toBe(true)

    act(() => buttonWith(view, 'Nueva alta').click())
    const dialog = view.querySelector('[role="dialog"]')
    act(() => {
      const select = dialog.querySelector('select')
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'grafica')
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    act(() => {
      const target = dialog.querySelectorAll('select')[1]
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(target, 'grafica-UBX')
      target.dispatchEvent(new Event('change', { bubbles: true }))
    })
    typeInto(dialog.querySelector('#alta-dialog-codigo'), '80')
    typeInto(dialog.querySelector('#alta-dialog-descripcion'), 'dragon')
    act(() => buttonWith(dialog, 'Guardar alta').click())

    expect(view.querySelector('[role="dialog"]')).toBeNull()
    expect(getAltas()).toHaveLength(1)
    const altasTable = [...view.querySelectorAll('.view:not([hidden]) table')].at(-1)
    expect(altasTable.textContent).toContain('DRAGON')
    expect(altasTable.textContent).toContain('Pendiente de aceptar')
    expect(view.querySelector('.sidebar__count').textContent).toBe('1')
    expect(buttonWith(view, 'Exportar a Excel').disabled).toBe(false)
  })

  it('muestra las tablas actuales, se busca en ellas y se agrega directo a la tabla que se ve', () => {
    const view = mount(<App />)
    act(() => [...view.querySelectorAll('.sidebar__link')].find((a) => a.textContent.includes('Altas de referencia')).click())
    const table = () => view.querySelector('.view:not([hidden]) .reference-table')

    // Calotas de URBAX: los registros que ya existen en CODIFICACION 2023.
    expect(table().textContent).toContain('ATLAS')
    expect(table().textContent).toContain('AVA')
    expect(table().textContent).toContain('Existente')
    expect(buttonWith(view, 'Exportar esta tabla').disabled).toBe(false)

    typeInto(view.querySelector('#ref-buscar'), 'ava')
    expect(table().textContent).toContain('AVA')
    expect(table().textContent).not.toContain('ATLAS')

    // Agregar desde la tabla: queda en esa misma tabla, marcado como nuevo.
    typeInto(view.querySelector('#ref-buscar'), '')
    act(() => buttonWith(view, 'Agregar a esta tabla').click())
    const dialog = view.querySelector('[role="dialog"]')
    expect(dialog.textContent).toContain('calota de casco')
    typeInto(dialog.querySelector('#alta-dialog-codigo'), '777')
    typeInto(dialog.querySelector('#alta-dialog-descripcion'), 'NUEVA')
    act(() => buttonWith(dialog, 'Guardar alta').click())
    expect(table().textContent).toContain('NUEVA')
    expect(table().textContent).toContain('Nueva · pendiente')
  })

  it('las tablas con ámbito (tipología de producto) piden elegir la familia antes de mostrarse', () => {
    const view = mount(<App />)
    act(() => [...view.querySelectorAll('.sidebar__link')].find((a) => a.textContent.includes('Altas de referencia')).click())
    const select = (id, value) =>
      act(() => {
        const element = view.querySelector(id)
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(element, value)
        element.dispatchEvent(new Event('change', { bubbles: true }))
      })
    select('#ref-tipo', 'tipologia')
    select('#ref-destino', 'tipologia-producto')
    expect(view.querySelector('.view:not([hidden]) .reference-table')).toBeNull()
    expect(buttonWith(view, 'Agregar a esta tabla').disabled).toBe(true)
    select('#ref-familia', 'RAINWEAR')
    expect(view.querySelector('.view:not([hidden]) .reference-table').textContent).toContain('RAINSUIT')
    expect(buttonWith(view, 'Agregar a esta tabla').disabled).toBe(false)
  })

  it('se filtra por marca y familia: cada marca muestra sus tablas y cada familia sus datos', () => {
    const view = mount(<App />)
    act(() => [...view.querySelectorAll('.sidebar__link')].find((a) => a.textContent.includes('Altas de referencia')).click())
    const select = (id, value) =>
      act(() => {
        const element = view.querySelector(id)
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(element, value)
        element.dispatchEvent(new Event('change', { bubbles: true }))
      })
    const table = () => view.querySelector('.view:not([hidden]) .reference-table')
    const kindsOffered = () => [...view.querySelectorAll('#ref-tipo option')].map((option) => option.value)
    const brandsOffered = [...view.querySelectorAll('#ref-marca option')].map((option) => option.textContent)

    // Todas las marcas del registro están en el filtro.
    ;['LS2', 'MAC', 'URBAX', 'NTO', 'GUD', '921'].forEach((label) => expect(brandsOffered).toContain(label))

    // NTO es solo de producto: no tiene calotas ni gráficas, sí artículos y colores.
    select('#ref-marca', 'NTO')
    expect(kindsOffered()).not.toContain('calota')
    expect(kindsOffered()).toEqual(expect.arrayContaining(['articulo', 'color', 'tipologia', 'generico']))

    // MAC + RAINWEAR: las tipologías de esa familia, sin pedir la familia otra vez.
    select('#ref-marca', 'MAC')
    select('#ref-familia-filtro', 'RAINWEAR')
    select('#ref-tipo', 'tipologia')
    expect(view.querySelector('#ref-familia')).toBeNull()
    expect(table().textContent).toContain('RAINSUIT')

    // LS2 + GUANTES: no hay tablas de composición, pero sí sus genéricos.
    select('#ref-marca', 'LS2')
    select('#ref-familia-filtro', 'GUANTES')
    expect(kindsOffered()).toEqual(expect.arrayContaining(['generico', 'color']))
    expect(kindsOffered()).not.toContain('calota')
    select('#ref-tipo', 'generico')
    const rows = [...table().querySelectorAll('tbody tr')].map((row) => row.textContent)
    expect(rows.length).toBeGreaterThan(0)
    rows.forEach((text) => {
      expect(text).toContain('LS2')
      expect(text).toContain('GUANTES')
    })
  })

  it('un alta duplicada muestra el error y no se guarda', () => {
    const view = mount(<App />)
    act(() => [...view.querySelectorAll('.sidebar__link')].find((a) => a.textContent.includes('Altas de referencia')).click())
    act(() => buttonWith(view, 'Nueva alta').click())
    const dialog = view.querySelector('[role="dialog"]')
    typeInto(dialog.querySelector('#alta-dialog-codigo'), '313')
    typeInto(dialog.querySelector('#alta-dialog-descripcion'), 'OTRA')
    act(() => buttonWith(dialog, 'Guardar alta').click())
    expect(dialog.textContent).toContain('ya lo usa AVA')
    expect(getAltas()).toHaveLength(0)
  })

  it('los SKU que usan un dato nuevo quedan bloqueados hasta aceptar la creación (Aceptar / Cancelar)', () => {
    createAlta('grafica-UBX', { codigo: '80', descripcion: 'DRAGON' })
    const brand = BRANDS.find((item) => item.id === 'UBX')
    const request = {
      nonce: 1,
      target: 'engine',
      engineId: ENGINES.cascosUBX.id,
      payload: {
        selections: { tipologia: '10', calota: '313', grafica: '80', color: 'I7' },
        sizes: ['.M'],
        descripcion: 'FF313 AVA DRAGON GLOSS BLACK BLUE',
        genericoKey: '',
        rowData: {},
      },
    }
    const view = mount(<EngineWorkspace brand={brand} engine={ENGINES.cascosUBX} confirmedItems={[]} onConfirmed={noop} loadRequest={request} />)
    expect(view.textContent).toContain('Los SKU están bloqueados')
    expect(view.textContent).toContain('UBX1031380I7.M')

    act(() => buttonWith(view, 'Revisar y aceptar').click())
    const dialog = view.querySelector('[role="dialog"]')
    expect(dialog.textContent).toContain('Aceptar la creación de los SKU')
    expect(dialog.textContent).toContain('UBX1031380I7.M')

    act(() => buttonWith(dialog, 'Cancelar').click())
    expect(view.querySelector('[role="dialog"]')).toBeNull()
    expect(view.textContent).toContain('Los SKU están bloqueados')

    act(() => buttonWith(view, 'Revisar y aceptar').click())
    act(() => buttonWith(view.querySelector('[role="dialog"]'), 'Aceptar').click())
    expect(view.querySelector('[role="dialog"]')).toBeNull()
    expect(view.textContent).not.toContain('Los SKU están bloqueados')
  })

  it('pegar la lista de códigos de URBAX muestra que los datos existen, y carga el motor con sus códigos', () => {
    const view = mount(<SkuGeneratorPage />)
    const textarea = view.querySelector('textarea')
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(textarea, PASTE_EXAMPLES.find((item) => item.id === 'variantes').text)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => buttonWith(view, 'Interpretar').click())
    expect(view.querySelectorAll('.variants__item')).toHaveLength(6)
    expect([...view.querySelectorAll('.variants__item .badge')].map((badge) => badge.textContent)).toEqual(Array(6).fill('Todo existe'))

    act(() => view.querySelectorAll('.variants__item button')[2].click())
    const parts = view.querySelector('.parts').textContent
    expect(parts).toContain('FF313 AVA ARCANO GLOSS BLACK RED')
    ;['313', 'AVA', '22', 'ARCANO', '50'].forEach((text) => expect(parts).toContain(text))
  })
})

describe('SKU genérico en pantalla', () => {
  const buttonWith = (view, text) => [...view.querySelectorAll('button')].find((b) => b.textContent.includes(text))

  it('se muestra en la composición y se confirma junto con los SKU por talle', async () => {
    const brand = BRANDS.find((item) => item.id === 'UBX')
    const request = {
      nonce: 1,
      target: 'engine',
      engineId: ENGINES.cascosUBX.id,
      payload: {
        selections: { tipologia: '10', calota: '313', grafica: '22', color: '50' },
        sizes: ['.S', '.M'],
        descripcion: 'FF313 AVA ARCANO GLOSS BLACK RED',
        genericoKey: 'UBX|UBX010313AB-GR|AVA',
        rowData: {},
      },
    }
    const view = mount(<EngineWorkspace brand={brand} engine={ENGINES.cascosUBX} confirmedItems={[]} onConfirmed={noop} loadRequest={request} />)
    expect(view.querySelector('.sku-generic').textContent).toContain('UBX103132250')

    act(() => buttonWith(view, 'Ejecutar validaciones').click())
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 800))
    })
    act(() => buttonWith(view, 'Confirmar SKU').click())

    const banner = view.querySelector('.confirmation')
    expect(banner.textContent).toContain('2 SKUs confirmados + 1 genérico')
    const rows = [...banner.querySelectorAll('tbody tr')].map((row) => row.textContent)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toContain('UBX103132250')
    expect(rows[0]).toContain('Genérico')
    expect(rows[1]).toContain('UBX103132250.S')
  })
})
