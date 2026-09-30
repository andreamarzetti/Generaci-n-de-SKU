import { useState } from 'react'
import { FamilySelector } from '../components/sku/FamilySelector'
import { BRANDS } from '../engines/engines'
import { EngineWorkspace } from './EngineWorkspace'
import { Ls2Workspace } from './Ls2Workspace'

/**
 * Primer paso: elegir la marca. LS2 usa su motor propio; el resto, el motor de la
 * marca y la línea. LS2 queda montado para no perder lo cargado al cambiar de marca.
 */
export function SkuGeneratorPage() {
  const [brandId, setBrandId] = useState('LS2')
  const [lineByBrand, setLineByBrand] = useState({})
  const [confirmedItems, setConfirmedItems] = useState([])

  const brand = BRANDS.find((item) => item.id === brandId)
  const line = brand.lines ? (brand.lines.find((item) => item.id === lineByBrand[brandId]) ?? brand.lines[0]) : null

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
      <Ls2Workspace brandField={brandField} hidden={brandId !== 'LS2'} />
      {line && (
        <EngineWorkspace
          key={line.engine.id}
          brand={brand}
          engine={line.engine}
          brandField={brandField}
          lineField={lineField}
          confirmedItems={confirmedItems}
          onConfirmed={(items) => setConfirmedItems((prev) => [...prev, ...items])}
        />
      )}
    </>
  )
}
