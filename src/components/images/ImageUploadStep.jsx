import { useEffect, useRef, useState } from 'react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Icon } from '../ui/Icon'
import { InfoPopup } from '../ui/InfoPopup'
import { LinkButton } from '../ui/LinkButton'

export const IMAGE_LIMITS = { types: ['image/jpeg', 'image/png', 'image/webp'], maxMB: 5, maxPerVariant: 8 }

const previewOf = (file) => {
  try {
    return URL.createObjectURL(file)
  } catch {
    return ''
  }
}

/** Un grupo por variante: el SKU genérico y los SKU de su curva comparten las imágenes. */
export function groupItems(items) {
  const groups = new Map()
  for (const item of items) {
    const key = item.generico || item.sku
    if (!groups.has(key)) groups.set(key, { key, skus: [], descripcion: item.descTango })
    if (!item.esGenerico) groups.get(key).skus.push(item.sku)
  }
  return [...groups.values()]
}

/**
 * Paso 4 · Imágenes. Diseño de carga: arrastrar o elegir archivos por variante, vista previa, imagen principal
 * (la primera) y orden. Hoy las imágenes quedan solo en la sesión del navegador: no se envían a ningún sistema.
 */
export function ImageUploadStep({ confirmation }) {
  const [images, setImages] = useState({}) // { [variante]: [{ id, name, size, url }] }
  const [errors, setErrors] = useState({})
  const [over, setOver] = useState(null)
  const counter = useRef(0)
  const latest = useRef(images)
  latest.current = images

  // Se liberan las vistas previas al salir.
  useEffect(
    () => () => {
      Object.values(latest.current)
        .flat()
        .forEach((image) => image.url && URL.revokeObjectURL?.(image.url))
    },
    [],
  )

  if (!confirmation) {
    return (
      <Card title="Imágenes" info={<InfoPopup label="Sobre las imágenes" title="Imágenes">Las imágenes se cargan por variante una vez confirmados los SKU.</InfoPopup>}>
        <p className="muted">Confirmá los SKU en el paso 3 para poder asociarles imágenes.</p>
      </Card>
    )
  }

  const groups = groupItems(confirmation.items)
  const total = Object.values(images).flat().length
  const withImages = groups.filter((group) => images[group.key]?.length).length

  const add = (key, fileList) => {
    const current = images[key] ?? []
    const accepted = []
    const problems = []
    for (const file of Array.from(fileList)) {
      if (!IMAGE_LIMITS.types.includes(file.type)) problems.push(`«${file.name}»: solo JPG, PNG o WEBP.`)
      else if (file.size > IMAGE_LIMITS.maxMB * 1024 * 1024) problems.push(`«${file.name}»: supera ${IMAGE_LIMITS.maxMB} MB.`)
      else if (current.length + accepted.length >= IMAGE_LIMITS.maxPerVariant) problems.push(`«${file.name}»: máximo ${IMAGE_LIMITS.maxPerVariant} imágenes por variante.`)
      else accepted.push({ id: ++counter.current, name: file.name, size: file.size, url: previewOf(file) })
    }
    setErrors((prev) => ({ ...prev, [key]: problems }))
    if (accepted.length) setImages((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), ...accepted] }))
  }

  const update = (key, change) => setImages((prev) => ({ ...prev, [key]: change(prev[key] ?? []) }))
  const remove = (key, id) => {
    const gone = images[key]?.find((image) => image.id === id)
    if (gone?.url) URL.revokeObjectURL?.(gone.url)
    update(key, (list) => list.filter((image) => image.id !== id))
  }
  const makeMain = (key, id) => update(key, (list) => [list.find((image) => image.id === id), ...list.filter((image) => image.id !== id)])
  const kb = (size) => `${Math.max(1, Math.round(size / 1024))} KB`

  return (
    <Card
      title="Imágenes de las variantes"
      info={
        <InfoPopup label="Reglas de las imágenes" title="Imágenes">
          <p>Formatos JPG, PNG o WEBP, hasta 5 MB y 8 imágenes por variante.</p>
          <p>La primera es la imagen principal. Valen para todos los talles de la variante.</p>
        </InfoPopup>
      }
      aside={<Badge tone={withImages === groups.length ? 'ok' : 'warn'}>{`${withImages} de ${groups.length} con imágenes`}</Badge>}
    >
      <p className="muted small">
        Todavía no hay a dónde enviarlas: por ahora quedan solo en esta pantalla (se pierden al recargar). {total} cargadas.
      </p>

      <div className="images">
        {groups.map((group) => {
          const list = images[group.key] ?? []
          const problems = errors[group.key] ?? []
          const inputId = `img-${group.key}`
          return (
            <section key={group.key} className="images__group" aria-label={`Imágenes de ${group.key}`}>
              <header className="images__head">
                <strong className="mono">{group.key}</strong>
                <span className="muted small">{group.skus.length ? `${group.skus.length} SKU con talle` : 'Sin curva de talles'}</span>
                {list.length > 0 && <Badge tone="ok">{`${list.length} ${list.length === 1 ? 'imagen' : 'imágenes'}`}</Badge>}
              </header>

              <label
                htmlFor={inputId}
                className={`images__drop ${over === group.key ? 'is-over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOver(group.key)
                }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  setOver(null)
                  add(group.key, e.dataTransfer.files)
                }}
              >
                <Icon name="image" size={22} />
                <span>Arrastrá imágenes acá o elegí archivos</span>
                <input
                  id={inputId}
                  type="file"
                  accept={IMAGE_LIMITS.types.join(',')}
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    add(group.key, e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>

              {problems.length > 0 && (
                <ul className="images__errors" role="alert">
                  {problems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              )}

              {list.length > 0 && (
                <ul className="images__list">
                  {list.map((image, index) => (
                    <li key={image.id} className="images__item">
                      <div className="images__thumb">{image.url ? <img src={image.url} alt={image.name} /> : <Icon name="image" size={24} />}</div>
                      <span className="images__name" title={image.name}>
                        {image.name}
                      </span>
                      <span className="muted small">{kb(image.size)}</span>
                      {index === 0 ? (
                        <Badge tone="ok">Principal</Badge>
                      ) : (
                        <LinkButton icon="check" onClick={() => makeMain(group.key, image.id)}>
                          Hacer principal
                        </LinkButton>
                      )}
                      <LinkButton icon="trash" tone="danger" iconOnly onClick={() => remove(group.key, image.id)}>
                        {`Quitar ${image.name}`}
                      </LinkButton>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      <div className="images__foot">
        <Button icon="trash" variant="danger" size="sm" disabled={total === 0} onClick={() => setImages({})}>
          Quitar todas
        </Button>
      </div>
    </Card>
  )
}
