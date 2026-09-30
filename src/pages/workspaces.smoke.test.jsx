// @vitest-environment jsdom
// Smoke test: monta las pantallas reales (con sus efectos) para detectar a tiempo
// errores de integración, como una propiedad obligatoria que un componente deja de recibir.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
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
})

const noop = () => {}
const engineLines = BRANDS.flatMap((brand) => (brand.lines ?? []).map((line) => ({ brand, line })))

describe('EngineWorkspace', () => {
  it.each(engineLines.map(({ brand, line }) => [`${brand.label} · ${line.label}`, brand, line]))(
    'monta %s sin romperse',
    (_, brand, line) => {
      const view = mount(<EngineWorkspace brand={brand} engine={line.engine} confirmedItems={[]} onConfirmed={noop} />)
      expect(view.textContent).toContain('Composición del SKU')
      expect(view.textContent).toContain('Reglas aplicadas')
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
})
