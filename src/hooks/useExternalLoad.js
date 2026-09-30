import { useEffect, useRef } from 'react'

/**
 * Aplica una carga pedida desde afuera (ej. "Pegar solicitud") una sola vez por pedido.
 * Si ya hay datos cargados y el pedido no está forzado, avisa para pedir confirmación.
 *
 * loadRequest: { nonce, force, ... } · onLoadResult({ nonce, status: 'confirm' | 'loaded' })
 */
export function useExternalLoad(loadRequest, { applies, hasData, apply, onLoadResult }) {
  const handledNonce = useRef(null)
  const latest = useRef({ applies, hasData, apply, onLoadResult })
  latest.current = { applies, hasData, apply, onLoadResult }

  useEffect(() => {
    if (!loadRequest || handledNonce.current === loadRequest.nonce) return
    const { applies: appliesNow, hasData: hasDataNow, apply: applyNow, onLoadResult: report } = latest.current
    if (!appliesNow(loadRequest)) return
    handledNonce.current = loadRequest.nonce
    if (hasDataNow && !loadRequest.force) {
      report?.({ nonce: loadRequest.nonce, status: 'confirm' })
      return
    }
    applyNow(loadRequest.payload)
    report?.({ nonce: loadRequest.nonce, status: 'loaded' })
  }, [loadRequest])
}
