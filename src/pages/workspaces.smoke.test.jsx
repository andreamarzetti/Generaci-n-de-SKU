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
    const toggle = () => act(() => view.querySelectorAll('.variants__item input')[1].click())
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

    act(() => view.querySelectorAll('.variants__item input')[2].click())
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

describe('varias variantes juntas', () => {
  const buttonWith = (view, text) => [...view.querySelectorAll('button')].find((b) => b.textContent.includes(text))
  const paste = (view, text) => {
    const textarea = view.querySelector('textarea')
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(textarea, text)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => buttonWith(view, 'Interpretar').click())
  }
  const chip = (root, label) => [...root.querySelectorAll('.size-chip')].find((element) => element.textContent === label)
  const urbax = () => PASTE_EXAMPLES.find((item) => item.id === 'variantes').text

  it('se marcan varias (o todas) y la revisión muestra la composición de cada una', () => {
    const view = mount(<SkuGeneratorPage />)
    paste(view, urbax())
    const boxes = () => [...view.querySelectorAll('.variants__item input')]

    act(() => boxes()[0].click())
    act(() => boxes()[2].click())
    expect(view.querySelector('.variants__toolbar').textContent).toContain('2 de 6 marcadas')
    expect(view.querySelectorAll('.parts__matrix tbody tr')).toHaveLength(2)
    expect(view.querySelector('.parts__matrix').textContent).toContain('FF313 AVA ARCANO GLOSS BLACK RED')

    // "Seleccionar todas" marca las 6 y, al repetirlo, las desmarca.
    act(() => view.querySelector('.variants__all input').click())
    expect(boxes().every((box) => box.checked)).toBe(true)
    expect(view.querySelectorAll('.parts__matrix tbody tr')).toHaveLength(6)
    expect(view.querySelector('#solicitud-curva')).not.toBeNull()
    act(() => view.querySelector('.variants__all input').click())
    expect(boxes().every((box) => !box.checked)).toBe(true)
    expect(view.querySelector('.parts__matrix')).toBeNull()
  })

  it('con más de una va a la carga masiva: una curva para todas y talles propios en una variante', () => {
    const view = mount(<SkuGeneratorPage />)
    paste(view, urbax())
    act(() => view.querySelector('.variants__all input').click())

    // Curva de talles elegida en la revisión.
    const curve = view.querySelector('#solicitud-curva')
    ;['S', 'M', 'L'].forEach((size) => act(() => chip(curve, size).click()))
    act(() => buttonWith(view, 'Cargar en la pantalla').click())

    // Se abre la carga masiva del motor de URBAX con las 6 variantes.
    const plan = view.querySelector('.plan')
    expect(plan.textContent).toContain('Carga masiva · 6 variantes')
    expect(plan.querySelectorAll('.plan__item')).toHaveLength(6)
    const stepTwo = () => view.querySelector('.main:not([hidden]) .wizard__panel[aria-label="Paso 2: Propuesta"]')
    const rowsOf = () => stepTwo().querySelectorAll('table.table tbody tr')
    expect(rowsOf()).toHaveLength(18)
    expect(stepTwo().textContent).toContain('UBX1031322I7.M')

    // Cambiar la curva afecta a todas las variantes.
    act(() => chip(plan.querySelector('.plan__list').previousElementSibling, 'XL').click())
    expect(rowsOf()).toHaveLength(24)

    // Editar los talles de una sola variante: las demás siguen con la curva.
    const first = () => view.querySelector('.plan__item')
    const inFirst = (label) => [...first().querySelectorAll('button')].find((b) => b.textContent.trim() === label)
    act(() => inFirst('Editar talles').click())
    act(() => chip(first(), 'S').click())
    // Mientras no se guarda, nada cambia: ni las filas ni la variante.
    expect(rowsOf()).toHaveLength(24)
    expect(first().textContent).not.toContain('Talles propios')

    // Cancelar descarta lo editado.
    act(() => inFirst('Cancelar').click())
    expect(first().querySelector('.plan__edit')).toBeNull()
    expect(rowsOf()).toHaveLength(24)

    // Guardar aplica los talles propios de esa variante.
    act(() => inFirst('Editar talles').click())
    act(() => chip(first(), 'S').click())
    act(() => inFirst('Guardar').click())
    expect(first().querySelector('.plan__edit')).toBeNull()
    expect(first().textContent).toContain('Talles propios')
    expect(rowsOf()).toHaveLength(23)
    expect(stepTwo().textContent).not.toContain('UBX1031322I7.S')
    expect(stepTwo().textContent).toContain('UBX1031322E8.S')

    // "Usar la curva" devuelve la variante a la curva de todas.
    act(() => [...first().querySelectorAll('button')].find((b) => b.textContent === 'Usar la curva').click())
    expect(rowsOf()).toHaveLength(24)
    expect(first().textContent).not.toContain('Talles propios')
  })

  it('si una variante tiene datos sin resolver, no se carga y se explica cuál', () => {
    const view = mount(<SkuGeneratorPage />)
    paste(view, ['FF313_AVA_ARCANO_GLOSS_BLACK_RED', 'FF313_AVA_ZETANUEVA_GLOSS_BLACK_RED'].join('\n'))
    act(() => view.querySelector('.variants__all input').click())
    act(() => buttonWith(view, 'Cargar en la pantalla').click())
    expect(view.querySelector('.text-error').textContent).toMatch(/Falta resolver gráfica en «FF313 AVA ZETANUEVA GLOSS BLACK RED»/)
    expect(view.querySelector('.plan')).toBeNull()
  })

  it('LS2: varias variantes de casco se cargan en la carga masiva con la curva', () => {
    const view = mount(<SkuGeneratorPage />)
    paste(view, ['FF806_FUSION_TECK_LIGHT_GRAY_RED_GLOSS', 'FF806_FUSION_TECK_BLACK_GLOSS'].join('\n'))
    act(() => view.querySelector('.variants__all input').click())
    ;['M', 'L'].forEach((size) => act(() => chip(view.querySelector('#solicitud-curva'), size).click()))
    act(() => buttonWith(view, 'Cargar en la pantalla').click())

    expect(view.querySelector('.plan').textContent).toContain('Carga masiva · 2 variantes')
    expect(view.querySelectorAll('.main:not([hidden]) .wizard__panel[aria-label="Paso 2: Propuesta"] tbody tr.row--main')).toHaveLength(4)
  })
})

describe('botones con icono y color por acción', () => {
  const byText = (view, text) => [...view.querySelectorAll('button')].find((b) => b.textContent.trim() === text)
  const mounted = () => mount(<App />)

  it('navegación: Anterior / Siguiente con flechas y colores de avance', () => {
    const view = mounted()
    expect(byText(view, 'Anterior').className).toContain('btn--secondary')
    expect(byText(view, 'Anterior').querySelector('svg.icon')).not.toBeNull()
    expect(byText(view, 'Siguiente').className).toContain('btn--primary')
    expect(byText(view, 'Siguiente').querySelector('svg.icon')).not.toBeNull()
  })

  it('confirmar y guardar son verdes; quitar y limpiar, rojos; analizar, negro', () => {
    const view = mounted()
    expect(byText(view, 'Confirmar SKU').className).toContain('btn--success')
    expect(byText(view, 'Ejecutar validaciones').className).toContain('btn--dark')
    expect(byText(view, 'Interpretar').className).toContain('btn--dark')
    expect(byText(view, 'Interpretar').querySelector('svg.icon')).not.toBeNull()
    expect(byText(view, 'Limpiar').className).toContain('btn--danger')
  })

  it('el menú lateral lleva un icono por sección', () => {
    const view = mounted()
    const links = [...view.querySelectorAll('.sidebar__link')]
    expect(links).toHaveLength(2)
    links.forEach((link) => expect(link.querySelector('svg.icon')).not.toBeNull())
  })

  it('en la carga masiva: Guardar es verde, Cancelar neutro y Quitar rojo', () => {
    const view = mounted()
    const textarea = view.querySelector('textarea')
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(textarea, PASTE_EXAMPLES.find((item) => item.id === 'variantes').text)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => byText(view, 'Interpretar').click())
    act(() => view.querySelector('.variants__all input').click())
    act(() => byText(view, 'Cargar en la pantalla').click())

    const item = view.querySelector('.plan__item')
    const inItem = (label) => [...item.querySelectorAll('button')].find((b) => b.textContent.trim() === label)
    expect(inItem('Quitar').className).toContain('link-button--danger')
    expect(inItem('Editar talles').querySelector('svg.icon')).not.toBeNull()
    act(() => inItem('Editar talles').click())
    expect(inItem('Guardar').className).toContain('btn--success')
    expect(inItem('Cancelar').className).toContain('btn--secondary')
    expect(inItem('Guardar').querySelector('svg.icon')).not.toBeNull()
  })
})

describe('paso 2: grupos plegables por variante', () => {
  const byText = (root, label) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === label)
  const stepTwo = (view) => view.querySelector('.main:not([hidden]) .wizard__panel[aria-label="Paso 2: Propuesta"]')

  function loadSixVariants() {
    const view = mount(<SkuGeneratorPage />)
    const textarea = view.querySelector('textarea')
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(textarea, PASTE_EXAMPLES.find((item) => item.id === 'variantes').text)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => byText(view, 'Interpretar').click())
    act(() => view.querySelector('.variants__all input').click())
    const curve = view.querySelector('#solicitud-curva')
    ;['S', 'M'].forEach((size) => act(() => [...curve.querySelectorAll('.size-chip')].find((chip) => chip.textContent === size).click()))
    act(() => byText(view, 'Cargar en la pantalla').click())
    return view
  }

  // Cada tarjeta (composición y SKUs a generar) tiene sus propios grupos.
  const groupsOf = (card) => [...card.querySelectorAll('.group')]
  const cards = (view) => [...stepTwo(view).querySelectorAll('.card')]
  const toggleOf = (group) => group.querySelector('.group__toggle')

  it('la composición y los SKU a generar agrupan por variante: el primero expandido y los demás comprimidos', () => {
    const view = loadSixVariants()
    const [composition, table] = cards(view)

    ;[composition, table].forEach((card) => {
      const groups = groupsOf(card)
      expect(groups).toHaveLength(6)
      expect(groups.map((group) => toggleOf(group).getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false', 'false', 'false', 'false'])
      expect(groups[0].querySelector('.group__body').hidden).toBe(false)
      expect(groups[1].querySelector('.group__body').hidden).toBe(true)
    })
  })

  it('cada grupo muestra el nombre de su variante y cuántos SKU tiene', () => {
    const view = loadSixVariants()
    const [composition, table] = cards(view)
    const group = groupsOf(table)[2]
    expect(group.querySelector('.group__name').textContent).toBe('FF313 AVA ARCANO GLOSS BLACK RED')
    expect(group.querySelector('.group__meta').textContent).toContain('2 SKUs')
    expect(groupsOf(composition)[2].querySelector('.group__name').textContent).toBe('FF313 AVA ARCANO GLOSS BLACK RED')
  })

  it('los demás se expanden y se comprimen a mano, y hay "Expandir todas" / "Contraer todas"', () => {
    const view = loadSixVariants()
    const table = cards(view)[1]
    const expanded = () => groupsOf(table).map((group) => toggleOf(group).getAttribute('aria-expanded'))

    act(() => toggleOf(groupsOf(table)[3]).click())
    expect(expanded()).toEqual(['true', 'false', 'false', 'true', 'false', 'false'])
    act(() => toggleOf(groupsOf(table)[0]).click())
    expect(expanded()).toEqual(['false', 'false', 'false', 'true', 'false', 'false'])

    act(() => byText(table, 'Expandir todas').click())
    expect(expanded().every((value) => value === 'true')).toBe(true)
    act(() => byText(table, 'Contraer todas').click())
    expect(expanded().every((value) => value === 'false')).toBe(true)
  })

  it('lo escrito en un grupo plegado no se pierde', () => {
    const view = loadSixVariants()
    const table = cards(view)[1]
    const group = () => groupsOf(table)[1]
    act(() => toggleOf(group()).click())
    const input = group().querySelector('input[aria-label^="EAN"]')
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '6937449162997')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => toggleOf(group()).click())
    act(() => toggleOf(group()).click())
    expect(group().querySelector('input[aria-label^="EAN"]').value).toBe('6937449162997')
  })

  it('con una sola variante no hay grupos', () => {
    const brand = BRANDS.find((item) => item.id === 'UBX')
    const request = {
      nonce: 1,
      target: 'engine',
      engineId: ENGINES.cascosUBX.id,
      payload: {
        selections: { tipologia: '10', calota: '313', grafica: '22', color: '50' },
        sizes: ['.S', '.M'],
        descripcion: 'FF313 AVA ARCANO GLOSS BLACK RED',
        genericoKey: '',
        rowData: {},
      },
    }
    const view = mount(<EngineWorkspace brand={brand} engine={ENGINES.cascosUBX} confirmedItems={[]} onConfirmed={noop} loadRequest={request} />)
    expect(view.querySelectorAll('.group')).toHaveLength(0)
    expect(view.querySelectorAll('.wizard__panel[aria-label="Paso 2: Propuesta"] table.table tbody tr')).toHaveLength(2)
  })

  it('LS2: la tabla de SKU también agrupa por variante', () => {
    const view = mount(<SkuGeneratorPage />)
    const textarea = view.querySelector('textarea')
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(textarea, ['FF806_FUSION_TECK_LIGHT_GRAY_RED_GLOSS', 'FF806_FUSION_TECK_BLACK_GLOSS'].join('\n'))
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => byText(view, 'Interpretar').click())
    act(() => view.querySelector('.variants__all input').click())
    const curve = view.querySelector('#solicitud-curva')
    ;['M', 'L'].forEach((size) => act(() => [...curve.querySelectorAll('.size-chip')].find((chip) => chip.textContent === size).click()))
    act(() => byText(view, 'Cargar en la pantalla').click())

    const table = cards(view).at(-1)
    const groups = groupsOf(table)
    expect(groups).toHaveLength(2)
    expect(groups.map((group) => toggleOf(group).getAttribute('aria-expanded'))).toEqual(['true', 'false'])
    expect(groups[0].querySelectorAll('tr.row--main')).toHaveLength(2)
  })
})

describe('pasar al paso 2 sin cargar lo interpretado', () => {
  const byText = (root, label) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === label)
  const visiblePanel = (view) => view.querySelector('.main:not([hidden]) .wizard__panel:not([hidden])').getAttribute('aria-label')
  const guard = (view) => view.querySelector('.wizard__guard')

  function interpreted() {
    const view = mount(<SkuGeneratorPage />)
    const textarea = view.querySelector('textarea')
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(textarea, PASTE_EXAMPLES.find((item) => item.id === 'mail').text)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => byText(view, 'Interpretar').click())
    return view
  }

  it('si hay algo interpretado sin cargar, "Siguiente" no avanza y explica que la carga es necesaria', () => {
    const view = interpreted()
    expect(guard(view)).toBeNull()

    act(() => byText(view, 'Siguiente').click())
    expect(visiblePanel(view)).toBe('Paso 1: Datos')
    expect(guard(view).textContent).toContain('hace falta cargar lo interpretado en la pantalla')
    expect(guard(view).textContent).toContain('se eligen los talles')
  })

  it('el número de un paso posterior también queda frenado', () => {
    const view = interpreted()
    act(() => view.querySelectorAll('.main:not([hidden]) .process__step')[2].click())
    expect(visiblePanel(view)).toBe('Paso 1: Datos')
    expect(guard(view)).not.toBeNull()
  })

  it('el aviso trae el botón para cargar; al cargar desaparece y ya se puede seguir', () => {
    const view = interpreted()
    act(() => byText(view, 'Siguiente').click())
    act(() => byText(guard(view), 'Cargar en la pantalla').click())

    expect(guard(view)).toBeNull()
    expect(view.querySelector('.paste__notice').textContent).toContain('Cargado en')
    expect(visiblePanel(view)).toBe('Paso 1: Datos')

    act(() => byText(view, 'Siguiente').click())
    expect(visiblePanel(view)).toBe('Paso 2: Propuesta')
    expect(guard(view)).toBeNull()
  })

  it('si la carga no es posible, el aviso lo dice y sigue frenado', () => {
    const view = mount(<SkuGeneratorPage />)
    const textarea = view.querySelector('textarea')
    // Un modelo que no está en los genéricos: no se puede deducir la marca.
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(textarea, 'FF999_NOVA_ARCANO_GLOSS_BLACK_RED')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => byText(view, 'Interpretar').click())
    act(() => byText(view, 'Siguiente').click())
    act(() => byText(guard(view), 'Cargar en la pantalla').click())

    expect(visiblePanel(view)).toBe('Paso 1: Datos')
    expect(guard(view).textContent).toContain('Completá la marca')
  })

  it('cambiar lo interpretado después de cargar obliga a cargarlo de nuevo', () => {
    const view = interpreted()
    act(() => byText(view, 'Siguiente').click())
    act(() => byText(guard(view), 'Cargar en la pantalla').click())
    expect(guard(view)).toBeNull()

    // Editar un dato de lo interpretado (la descripción) lo deja sin cargar otra vez.
    const description = view.querySelector('#solicitud-descripcion')
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(description, 'FF806 FUSION OTRA')
      description.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => byText(view, 'Siguiente').click())
    expect(visiblePanel(view)).toBe('Paso 1: Datos')
    expect(guard(view)).not.toBeNull()
  })

  it('sin nada interpretado, o al volver atrás, no hay aviso', () => {
    const view = mount(<SkuGeneratorPage />)
    act(() => byText(view, 'Siguiente').click())
    expect(visiblePanel(view)).toBe('Paso 2: Propuesta')
    act(() => byText(view, 'Anterior').click())
    expect(visiblePanel(view)).toBe('Paso 1: Datos')
    expect(guard(view)).toBeNull()
  })
})

describe('mensaje al pasar el mouse en la composición del SKU', () => {
  const tooltip = () => document.body.querySelector('[role="tooltip"]')
  const loaded = () => {
    const brand = BRANDS.find((item) => item.id === 'UBX')
    const request = {
      nonce: 1,
      target: 'engine',
      engineId: ENGINES.cascosUBX.id,
      payload: {
        selections: { tipologia: '10', calota: '313', grafica: '22', color: '50' },
        sizes: ['.M'],
        descripcion: 'FF313 AVA ARCANO GLOSS BLACK RED',
        genericoKey: '',
        rowData: {},
      },
    }
    return mount(<EngineWorkspace brand={brand} engine={ENGINES.cascosUBX} confirmedItems={[]} onConfirmed={noop} loadRequest={request} />)
  }
  const cell = (view, value) => [...view.querySelectorAll('.sku-parts .tip-target')].find((element) => element.textContent === value)

  it('al enfocar o pasar el mouse por un código explica qué significa; al salir desaparece', () => {
    const view = loaded()
    expect(tooltip()).toBeNull()

    act(() => cell(view, '10').focus())
    expect(tooltip().textContent).toContain('Tipología')
    expect(tooltip().textContent).toContain('10 → FF SV')

    act(() => cell(view, '10').blur())
    expect(tooltip()).toBeNull()

    act(() => {
      cell(view, '313').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })
    expect(tooltip().textContent).toContain('313 → AVA')
    act(() => {
      cell(view, '313').dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
    })
    expect(tooltip()).toBeNull()
  })

  it('cada parte del SKU tiene su mensaje: marca, gráfica, color y talle', () => {
    const view = loaded()
    const messageOf = (value) => {
      act(() => cell(view, value).focus())
      const message = tooltip().textContent
      act(() => cell(view, value).blur())
      return message
    }
    expect(messageOf('UBX')).toContain('URBAX')
    expect(messageOf('22')).toContain('22 → ARCANO')
    expect(messageOf('50')).toContain('50 → GLOSS BLACK RED')
    expect(messageOf('.M')).toContain('M')
  })

  it('un dato nuevo sin aceptar lo avisa en el mensaje', () => {
    createAlta('grafica-UBX', { codigo: '80', descripcion: 'DRAGON' })
    const brand = BRANDS.find((item) => item.id === 'UBX')
    const request = {
      nonce: 1,
      target: 'engine',
      engineId: ENGINES.cascosUBX.id,
      payload: { selections: { tipologia: '10', calota: '313', grafica: '80', color: '50' }, sizes: ['.M'], descripcion: 'X', genericoKey: '', rowData: {} },
    }
    const view = mount(<EngineWorkspace brand={brand} engine={ENGINES.cascosUBX} confirmedItems={[]} onConfirmed={noop} loadRequest={request} />)
    act(() => cell(view, '80').focus())
    expect(tooltip().textContent).toContain('80 → DRAGON')
    expect(tooltip().textContent).toContain('pendiente de aceptar')
  })

  it('LS2: el prefijo, los 7 dígitos y los libres también explican su origen', () => {
    const view = mount(<Ls2Workspace brandField={null} loadRequest={{ ...toScreenLoad(interpretRequest(PASTE_EXAMPLES[0].text)), nonce: 1 }} />)
    act(() => cell(view, 'LS2').focus())
    expect(tooltip().textContent).toContain('Marca')
    act(() => cell(view, 'LS2').blur())
    act(() => cell(view, '9806002').focus())
    expect(tooltip().textContent).toContain('7 dígitos del código de barras')
    act(() => cell(view, '9806002').blur())
    act(() => cell(view, '01').focus())
    expect(tooltip().textContent).toContain('Dígitos libres')
  })
})

describe('SKU ya existente: se omitirá su creación', () => {
  const byText = (root, label) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === label)
  const wait = (ms) =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, ms))
    })

  function loaded(sizes) {
    const brand = BRANDS.find((item) => item.id === 'UBX')
    const request = {
      nonce: 1,
      target: 'engine',
      engineId: ENGINES.cascosUBX.id,
      payload: {
        // FF313 AVA ARCANO GLOSS BLACK BLUE: en los datos reales existen S, M, L, XL y 2X; XS no.
        selections: { tipologia: '10', calota: '313', grafica: '22', color: 'I7' },
        sizes,
        descripcion: 'FF313 AVA ARCANO GLOSS BLACK BLUE',
        genericoKey: '',
        rowData: {},
      },
    }
    return mount(<EngineWorkspace brand={brand} engine={ENGINES.cascosUBX} confirmedItems={[]} onConfirmed={noop} loadRequest={request} />)
  }

  it('lo existente se avisa y se omite: solo se confirma lo nuevo, y el resumen lo cuenta', async () => {
    const view = loaded(['.XS', '.S', '.M', '.L', '.XL', '.2X'])
    act(() => byText(view, 'Ejecutar validaciones').click())
    await wait(800)

    // Aviso en cada SKU existente; ninguno bloquea.
    const results = [...view.querySelectorAll('.wizard__panel[aria-label="Paso 2: Propuesta"] table.table tbody tr')]
    expect(results.filter((row) => row.classList.contains('row--omit'))).toHaveLength(5)
    expect(view.querySelector('.conflicts').textContent).toContain('SKU ya existente: se omitirá su creación')
    expect(byText(view, 'Confirmar SKU').disabled).toBe(true)

    act(() => view.querySelector('.action-bar input[type="checkbox"]').click())
    act(() => byText(view, 'Confirmar SKU').click())

    const banner = view.querySelector('.confirmation')
    expect(banner.textContent).toContain('1 SKU confirmado')
    // El genérico ya existe (hay talles creados): se reutiliza, no se crea de nuevo.
    expect(banner.textContent).not.toContain('genérico ·')
    expect([...banner.querySelectorAll('tbody tr')].map((row) => row.querySelector('td').textContent.trim())).toEqual(['UBX1031322I7.XS'])
    expect(banner.querySelector('.confirmation__omitted').textContent).toContain('Se omitió la creación de 5 SKUs ya existentes')
    expect(banner.querySelector('.confirmation__omitted').textContent).toContain('UBX1031322I7.S')
  })

  it('si todos ya existen, no hay nada para crear y no se puede confirmar', async () => {
    const view = loaded(['.S', '.M'])
    act(() => byText(view, 'Ejecutar validaciones').click())
    await wait(800)
    expect(view.querySelector('.action-bar__hint').textContent).toContain('Todos los SKU ya existen: no hay nada nuevo para crear')
    const ack = view.querySelector('.action-bar input[type="checkbox"]')
    if (ack) act(() => ack.click())
    expect(byText(view, 'Confirmar SKU').disabled).toBe(true)
  })
})

describe('paso 3: validaciones agrupadas por variante', () => {
  const byText = (root, label) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === label)
  const wait = (ms) =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, ms))
    })
  const stepThree = (view) => view.querySelector('.main:not([hidden]) .wizard__panel[aria-label="Paso 3: Validar y confirmar"]')

  async function validatedSixVariants() {
    const view = mount(<SkuGeneratorPage />)
    const textarea = view.querySelector('textarea')
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(textarea, PASTE_EXAMPLES.find((item) => item.id === 'variantes').text)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => byText(view, 'Interpretar').click())
    act(() => view.querySelector('.variants__all input').click())
    const curve = view.querySelector('#solicitud-curva')
    ;['S', 'M'].forEach((size) => act(() => [...curve.querySelectorAll('.size-chip')].find((chip) => chip.textContent === size).click()))
    act(() => byText(view, 'Cargar en la pantalla').click())
    act(() => byText(stepThree(view), 'Ejecutar validaciones').click())
    await wait(800)
    return view
  }

  it('los errores y advertencias se agrupan por variante: la primera expandida y las demás plegadas', async () => {
    const view = await validatedSixVariants()
    const groups = [...stepThree(view).querySelectorAll('.conflicts .group')]
    expect(groups).toHaveLength(6)
    expect(groups.map((group) => group.querySelector('.group__toggle').getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false', 'false', 'false', 'false'])
    expect(groups[0].querySelector('.group__name').textContent).toBe('FF313 AVA ARCANO GLOSS BLACK BLUE')
  })

  it('cada grupo resume su estado sin abrirlo: advertencias o "Sin problemas"', async () => {
    const view = await validatedSixVariants()
    const groups = [...stepThree(view).querySelectorAll('.conflicts .group')]
    const meta = (index) => groups[index].querySelector('.group__meta').textContent
    // BLACK BLUE (I7) ya existe en S y M: se omiten.
    expect(meta(0)).toContain('2 SKUs')
    expect(meta(0)).toContain('2 advertencias')
    // BLACK RED (50) es nueva: nada que avisar.
    expect(meta(2)).toContain('Sin problemas')
  })

  it('el contenido de cada grupo son sus propios avisos, y se abre a mano', async () => {
    const view = await validatedSixVariants()
    const groups = () => [...stepThree(view).querySelectorAll('.conflicts .group')]
    expect(groups()[0].querySelector('.group__body').textContent).toContain('UBX1031322I7.S')
    expect(groups()[0].querySelector('.group__body').textContent).toContain('SKU ya existente: se omitirá su creación')
    expect(groups()[0].querySelector('.group__body').textContent).not.toContain('UBX1031322E8')

    expect(groups()[2].querySelector('.group__body').hidden).toBe(true)
    act(() => groups()[2].querySelector('.group__toggle').click())
    expect(groups()[2].querySelector('.group__body').hidden).toBe(false)
    expect(groups()[2].querySelector('.group__body').textContent).toContain('UBX103132250.S')
    expect(groups()[2].querySelector('.group__body').textContent).toContain('Sin problemas')
    expect(groups()[2].querySelectorAll('.conflict.is-ok')).toHaveLength(2)
  })

  it('con una sola variante, la lista sigue plana', async () => {
    const brand = BRANDS.find((item) => item.id === 'UBX')
    const request = {
      nonce: 1,
      target: 'engine',
      engineId: ENGINES.cascosUBX.id,
      payload: {
        selections: { tipologia: '10', calota: '313', grafica: '22', color: 'I7' },
        sizes: ['.S'],
        descripcion: 'FF313 AVA ARCANO GLOSS BLACK BLUE',
        genericoKey: '',
        rowData: {},
      },
    }
    const view = mount(<EngineWorkspace brand={brand} engine={ENGINES.cascosUBX} confirmedItems={[]} onConfirmed={noop} loadRequest={request} />)
    act(() => byText(view, 'Ejecutar validaciones').click())
    await wait(800)
    expect(view.querySelector('.conflicts').textContent).toContain('SKU ya existente: se omitirá su creación')
    expect(view.querySelectorAll('.conflicts .group')).toHaveLength(0)
  })
})

describe('casos sin problemas en la validación y la confirmación', () => {
  const byText = (root, label) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === label)
  const wait = (ms) =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, ms))
    })

  function loaded({ color, sizes, rowData = {} }) {
    const brand = BRANDS.find((item) => item.id === 'UBX')
    const request = {
      nonce: 1,
      target: 'engine',
      engineId: ENGINES.cascosUBX.id,
      payload: {
        selections: { tipologia: '10', calota: '313', grafica: '22', color },
        sizes,
        descripcion: 'FF313 AVA ARCANO GLOSS',
        genericoKey: '',
        rowData,
      },
    }
    return mount(<EngineWorkspace brand={brand} engine={ENGINES.cascosUBX} confirmedItems={[]} onConfirmed={noop} loadRequest={request} />)
  }
  const validate = async (view) => {
    act(() => byText(view, 'Ejecutar validaciones').click())
    await wait(800)
  }

  it('la validación lista también los SKU que pasaron sin problemas', async () => {
    // BLACK RED (50) es una variante nueva: S y M pasan todos los controles.
    const view = loaded({ color: '50', sizes: ['.S', '.M'] })
    await validate(view)
    const ok = [...view.querySelectorAll('.conflicts .conflict.is-ok')]
    expect(ok.map((row) => row.querySelector('.mono').textContent)).toEqual(['UBX103132250.S', 'UBX103132250.M'])
    expect(ok[0].textContent).toContain('Sin problemas')
    expect(view.querySelector('.conflicts__title').textContent).toBe('Resultado por SKU')
  })

  it('con avisos y casos sin problemas a la vez, aparecen los dos', async () => {
    // BLACK BLUE (I7): S existe (se omite) y XS es nuevo pero reutiliza el genérico.
    const view = loaded({ color: 'I7', sizes: ['.XS', '.S'] })
    await validate(view)
    expect(view.querySelectorAll('.conflicts .conflict.is-warn').length).toBeGreaterThan(0)
    expect(view.querySelectorAll('.conflicts .conflict.is-ok')).toHaveLength(0)
  })

  it('antes de confirmar, "Qué se va a crear" muestra lo nuevo, lo reutilizado y lo omitido', async () => {
    const view = loaded({ color: 'I7', sizes: ['.XS', '.S', '.M', '.L', '.XL', '.2X'] })
    expect(view.querySelector('.creation')).toBeNull()
    await validate(view)

    const preview = view.querySelector('.creation').textContent
    expect(preview).toContain('Qué se va a crear')
    expect(preview).toContain('1 SKU nuevo')
    expect(preview).toContain('UBX1031322I7.XS')
    expect(preview).toContain('Se reutiliza el genérico ya existente')
    expect(preview).toContain('5 SKUs ya existentes: se omitirá su creación')
  })

  it('una variante nueva muestra sus SKU y su genérico nuevo', async () => {
    const view = loaded({ color: '50', sizes: ['.S', '.M'] })
    await validate(view)
    const preview = view.querySelector('.creation').textContent
    expect(preview).toContain('2 SKUs nuevos')
    expect(preview).toContain('+ 1 genérico nuevo')
    expect(preview).toContain('UBX103132250 · UBX103132250.S · UBX103132250.M')
    expect(preview).not.toContain('ya existentes')
  })

  it('lo que tiene errores no cuenta como nuevo y se avisa que impide confirmar', async () => {
    // Un EAN con dígito verificador inválido bloquea ese SKU.
    const view = loaded({ color: '50', sizes: ['.S', '.M'], rowData: { '.S': { ean: '6937449162990' } } })
    await validate(view)
    const preview = view.querySelector('.creation').textContent
    expect(preview).toContain('1 SKU nuevo')
    expect(preview).toContain('1 SKU con error')
    expect(preview).toContain('no se puede confirmar hasta resolverlos')
    expect(byText(view, 'Confirmar SKU').disabled).toBe(true)
  })

  it('el resumen desaparece al confirmar y la confirmación muestra lo creado', async () => {
    const view = loaded({ color: '50', sizes: ['.S', '.M'] })
    await validate(view)
    act(() => byText(view, 'Confirmar SKU').click())
    expect(view.querySelector('.creation')).toBeNull()
    expect(view.querySelector('.confirmation').textContent).toContain('2 SKUs confirmados + 1 genérico')
  })
})
