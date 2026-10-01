import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const HALF_WIDTH = 150
const MARGIN = 8

/**
 * Mensaje al pasar el mouse o enfocar con el teclado. Se dibuja fuera del contenido (en el body), así
 * no lo recortan las tablas con scroll. Se coloca arriba del elemento, o abajo si no hay lugar.
 */
export function Tooltip({ content, children }) {
  const target = useRef(null)
  const id = useId()
  const [position, setPosition] = useState(null)

  const show = () => {
    const rect = target.current.getBoundingClientRect()
    const x = Math.min(Math.max(rect.left + rect.width / 2, HALF_WIDTH + MARGIN), window.innerWidth - HALF_WIDTH - MARGIN)
    const below = rect.top < 90
    setPosition({ x, y: below ? rect.bottom + MARGIN : rect.top - MARGIN, below })
  }
  const hide = () => setPosition(null)

  return (
    <>
      <span
        ref={target}
        className="tip-target"
        tabIndex={0}
        aria-describedby={position ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {position &&
        createPortal(
          <div
            role="tooltip"
            id={id}
            className={`tooltip ${position.below ? 'tooltip--below' : ''}`}
            style={{ left: position.x, top: position.y }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  )
}
