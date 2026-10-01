import { useSyncExternalStore } from 'react'
import { getAltas, subscribe } from './store'

/**
 * Altas de referencia vigentes. El componente se vuelve a dibujar cuando cambian,
 * y la lista sirve de dependencia para recalcular lo que leyó de los catálogos.
 */
export function useAltas() {
  return useSyncExternalStore(subscribe, getAltas, getAltas)
}
