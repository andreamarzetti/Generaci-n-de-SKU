import { useRef, useState } from 'react'
import { PasteRequestCard } from '../components/paste/PasteRequestCard'
import { FamilySelector } from '../components/sku/FamilySelector'
import { BRANDS } from '../engines/engines'
import { interpretRequest } from '../parsing/interpret'
import { toScreenLoad } from '../parsing/toScreen'
import { FAMILIES } from '../rules/families'
import { EngineWorkspace } from './EngineWorkspace'
import { Ls2Workspace } from './Ls2Workspace'

const INITIAL_PASTE = { open: true, text: '', draft: null, message: null, loadError: null, pendingConfirm: null, notice: null }

/**
 * Primer paso: elegir la marca (o pegar la solicitud, que la completa). LS2 usa su
 * motor propio; el resto, el motor de la marca y la línea. LS2 queda montado para
 * no perder lo cargado al cambiar de marca.
 */
export function SkuGeneratorPage() {
  const [brandId, setBrandId] = useState('LS2')
  const [lineByBrand, setLineByBrand] = useState({})
  const [confirmedItems, setConfirmedItems] = useState([])
  const [paste, setPaste] = useState(INITIAL_PASTE)
  const [loadRequest, setLoadRequest] = useState(null)
  // Número de pedido siempre creciente: cada carga se aplica una sola vez.
  const loadCounter = useRef(0)

  const brand = BRANDS.find((item) => item.id === brandId)
  const line = brand.lines ? (brand.lines.find((item) => item.id === lineByBrand[brandId]) ?? brand.lines[0]) : null
  const updatePaste = (changes) => setPaste((prev) => ({ ...prev, ...changes }))

  const targetLabel = (request) => {
    const target = BRANDS.find((item) => item.id === request.brandId)
    if (request.target === 'ls2') return `LS2 · ${FAMILIES[request.payload.familyId].label}`
    return `${target.label} · ${target.lines.find((item) => item.id === request.lineId).label}`
  }

  const pasteActions = {
    toggle: () => updatePaste({ open: !paste.open }),
    setText: (text) => updatePaste({ text }),
    clear: () => setPaste({ ...INITIAL_PASTE }),
    interpret: () => {
      const result = interpretRequest(paste.text)
      updatePaste({
        draft: result.empty ? null : result,
        message: result.message,
        loadError: null,
        pendingConfirm: null,
        notice: null,
      })
    },
    setDraft: (draft) => updatePaste({ draft, loadError: null }),
    load: () => {
      const load = toScreenLoad(paste.draft)
      if (!load.ok) {
        updatePaste({ loadError: load.reason })
        return
      }
      setBrandId(load.brandId)
      if (load.lineId) setLineByBrand((prev) => ({ ...prev, [load.brandId]: load.lineId }))
      loadCounter.current += 1
      setLoadRequest({ ...load, nonce: loadCounter.current, force: false })
      updatePaste({ loadError: null, notice: null })
    },
    confirmReplace: () => {
      loadCounter.current += 1
      setLoadRequest((prev) => ({ ...prev, nonce: loadCounter.current, force: true }))
      updatePaste({ pendingConfirm: null })
    },
    cancelReplace: () => {
      setLoadRequest(null)
      updatePaste({ pendingConfirm: null, notice: 'No se cargó nada: se mantuvieron los datos anteriores.' })
    },
  }

  // Un pedido de carga se descarta al terminar, para que no se reaplique al volver a una marca.
  const onLoadResult = ({ status }) => {
    if (status === 'confirm') {
      updatePaste({ pendingConfirm: targetLabel(loadRequest) })
      return
    }
    updatePaste({
      pendingConfirm: null,
      notice: `Cargado en ${targetLabel(loadRequest)}. Revisá la propuesta, completá lo que falte y validá.`,
    })
    setLoadRequest(null)
  }

  const topSlot = <PasteRequestCard state={paste} actions={pasteActions} />

  const brandField = (
    <div className="field">
      <span className="field__label">Marca</span>
      <FamilySelector label="Marca" families={BRANDS} value={brandId} onChange={setBrandId} />
    </div>
  )

  const lineField =
    brand.lines && brand.lines.length > 1 ? (
      <div className="field">
        <span className="field__label">Línea</span>
        <FamilySelector
          label="Línea"
          families={brand.lines}
          value={line.id}
          onChange={(lineId) => setLineByBrand((prev) => ({ ...prev, [brandId]: lineId }))}
        />
      </div>
    ) : null

  return (
    <>
      <Ls2Workspace
        brandField={brandField}
        hidden={brandId !== 'LS2'}
        topSlot={brandId === 'LS2' ? topSlot : null}
        loadRequest={loadRequest}
        onLoadResult={onLoadResult}
      />
      {line && (
        <EngineWorkspace
          key={line.engine.id}
          brand={brand}
          engine={line.engine}
          brandField={brandField}
          lineField={lineField}
          confirmedItems={confirmedItems}
          onConfirmed={(items) => setConfirmedItems((prev) => [...prev, ...items])}
          topSlot={topSlot}
          loadRequest={loadRequest}
          onLoadResult={onLoadResult}
        />
      )}
    </>
  )
}
