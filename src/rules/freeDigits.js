import { EXISTING_SKUS } from '../data/realData'
import { FREE_DIGIT_RANGE } from './constants'

const CASCO_SKU = /^LS2(\d{7})(\d{2})\./

/**
 * Estado de los 2 dígitos libres para un prefijo de 7 dígitos.
 * `sources` indica dónde buscar SKUs ya usados (por defecto, los artículos reales de LS2).
 */
export function getFreeDigitOptions(prefix, sources = [{ label: 'artículos LS2', skus: EXISTING_SKUS }]) {
  const usage = {}
  sources.forEach(({ label, skus }) => {
    skus.forEach((sku) => {
      const match = CASCO_SKU.exec(sku)
      if (match && match[1] === prefix && !usage[match[2]]) usage[match[2]] = label
    })
  })
  return FREE_DIGIT_RANGE.map((value) => ({ value, usedIn: usage[value] ?? null }))
}

/**
 * Asigna un par de dígitos libres a cada grupo (7 dígitos + variante).
 * Si varios grupos comparten el prefijo, reciben pares distintos y consecutivos
 * entre los libres. `choices` (grupo → par) permite cambiarlos a mano.
 */
export function assignFreeDigits(groups, { sources, choices = {} } = {}) {
  const takenByPrefix = new Map()
  return groups.map((group) => {
    const taken = takenByPrefix.get(group.prefix) ?? new Set()
    const options = getFreeDigitOptions(group.prefix, sources).map((option) => ({
      ...option,
      usedIn: option.usedIn ?? (taken.has(option.value) ? 'otra variante del lote' : null),
    }))
    const available = options.filter((option) => !option.usedIn)
    const chosen = choices[group.key]
    const freeDigit = available.some((option) => option.value === chosen) ? chosen : (available[0]?.value ?? null)
    if (freeDigit) {
      taken.add(freeDigit)
      takenByPrefix.set(group.prefix, taken)
    }
    return { ...group, options, freeDigit, exhausted: !freeDigit }
  })
}

export function freeDigitsExhaustedMessage(prefix) {
  const first = FREE_DIGIT_RANGE[0]
  const last = FREE_DIGIT_RANGE[FREE_DIGIT_RANGE.length - 1]
  return `Los ${FREE_DIGIT_RANGE.length} pares de dígitos libres (${first}–${last}) ya están usados con el prefijo ${prefix}. No se puede armar el SKU sin definir otro par con el área.`
}
