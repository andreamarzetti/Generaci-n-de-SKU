// Catálogos que usa la interpretación. Se inyectan en interpretRequest() para que la
// lógica se pueda mover a un servicio de backend sin depender de la pantalla.
import { ALL_GENERICOS, OFFICIAL_SIZES } from '../data/realData'
import { normalizeSize } from '../rules/sizes'

/** Marcas reconocibles por nombre en el texto (id = el de la pantalla). */
export const BRAND_NAMES = [
  { id: 'LS2', names: ['LS2'] },
  { id: 'MAC', names: ['MAC'] },
  { id: 'UBX', names: ['URBAX', 'UBX'] },
  { id: 'NTO', names: ['NTO', 'NINE TO ONE'] },
  { id: 'GUD', names: ['GUD'] },
  { id: '921', names: ['921'] },
]

export const FAMILY_NAMES = [
  { familia: 'CASCOS', names: ['CASCOS', 'CASCO'] },
  { familia: 'INDUMENTARIA', names: ['INDUMENTARIA'] },
  { familia: 'GUANTES', names: ['GUANTES', 'GUANTE'] },
  { familia: 'CORDURA', names: ['CORDURA'] },
  { familia: 'CALZADO', names: ['CALZADO'] },
  { familia: 'RAINWEAR', names: ['RAINWEAR'] },
  { familia: 'EQUIPAJE', names: ['EQUIPAJE'] },
  { familia: 'ACCESORIOS', names: ['ACCESORIOS'] },
  { familia: 'REPUESTOS', names: ['REPUESTOS', 'REPUESTO'] },
]

export const DEFAULT_CATALOGS = {
  genericos: ALL_GENERICOS,
  brands: BRAND_NAMES,
  families: FAMILY_NAMES,
  sizeOrder: OFFICIAL_SIZES.filter((size) => size !== 'TU'),
  normalizeSize,
}
