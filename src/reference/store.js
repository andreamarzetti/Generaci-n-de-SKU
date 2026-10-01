// Altas de referencia: lo que el usuario crea (marca, modelo, gráfica, color, genérico…) y todavía
// no está en CODIFICACION 2023. Se guarda en el navegador y se agrega a los catálogos en memoria,
// para que los motores y la interpretación del mail lo reconozcan. Después se exporta a Excel.
//
// Una alta nace "pendiente": se puede elegir, pero los SKU que la usan quedan bloqueados
// hasta que el usuario acepta su creación.
import { ALL_GENERICOS, GENERICOS } from '../data/realData'
import { BRANDS, CUSTOM_CASCOS, ENGINES, cascosEngine, productEngine } from '../engines/engines'
import { BRAND_NAMES } from '../parsing/catalogs'
import { getTarget, validateAlta } from './targets'

export const ALTA_STATUS = { PENDING: 'pendiente', ACCEPTED: 'aceptada' }

const STORAGE_KEY = 'sku.altas-referencia.v1'
// Usuario fijo hasta que exista el login.
const CURRENT_USER = 'Usuario'

let entries = []
let counter = 0
const listeners = new Set()

const uppercase = (value) => String(value ?? '').trim().toUpperCase()

// ── Persistencia ──────────────────────────────────────────

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Sin almacenamiento (ventana privada, bloqueado): las altas viven solo en esta sesión.
  }
}

function emit() {
  listeners.forEach((listener) => listener())
}

export const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export const getAltas = () => entries
export const getAlta = (id) => entries.find((entry) => entry.id === id) ?? null
export const isPendingAlta = (id) => getAlta(id)?.status === ALTA_STATUS.PENDING

// ── Aplicar al catálogo en memoria ────────────────────────

function applyBrand(entry, record) {
  const { id, label, plantilla } = record
  const lines = []
  if (plantilla === 'cascos' || plantilla === 'ambos') {
    const engine = cascosEngine(id)
    ENGINES[`cascos${id}`] = engine
    lines.push({ id: 'cascos', label: 'Cascos y repuestos de casco', engine })
  }
  if (plantilla === 'producto' || plantilla === 'ambos') {
    const engine = productEngine(id)
    ENGINES[`producto${id}`] = engine
    lines.push({ id: 'producto', label: 'Producto', engine })
  }
  BRANDS.push({ id, label, lines, alta: entry.id })
  BRAND_NAMES.push({ id, names: [...new Set([id, label])], alta: entry.id })
}

function applyEntry(entry) {
  const target = getTarget(entry.target)
  if (!target) return false
  const record = { ...target.record(entry.values), alta: entry.id }

  if (target.kind === 'marca') applyBrand(entry, record)
  else if (target.kind === 'generico') {
    ALL_GENERICOS.push({ ...record, key: `${record.marca}|${record.codigo}|${record.modelo}` })
    if (record.marca === 'LS2') {
      const { marca, ...rest } = record
      GENERICOS.push({ ...rest, key: `${record.codigo}|${record.modelo}` })
    }
  } else target.list(entry.values).push(record)
  return true
}

function unapplyEntry(entry) {
  const target = getTarget(entry.target)
  if (!target) return
  const drop = (list) => {
    const index = list.findIndex((item) => item.alta === entry.id)
    if (index !== -1) list.splice(index, 1)
  }
  if (target.kind === 'marca') {
    const code = uppercase(entry.values.codigo)
    drop(BRANDS)
    drop(BRAND_NAMES)
    delete ENGINES[`cascos${code}`]
    delete ENGINES[`producto${code}`]
    delete CUSTOM_CASCOS[code]
  } else if (target.kind === 'generico') {
    drop(ALL_GENERICOS)
    drop(GENERICOS)
  } else drop(target.list(entry.values))
}

// ── API ───────────────────────────────────────────────────

const newId = () => `alta-${Date.now().toString(36)}-${(counter += 1)}`

/** Crea un alta pendiente. Devuelve { ok, entry } o { ok: false, errors }. */
export function createAlta(targetId, values) {
  const target = getTarget(targetId)
  if (!target) return { ok: false, errors: { _: 'No se reconoce qué se quiere dar de alta.' } }
  const { errors } = validateAlta(target, values)
  if (Object.keys(errors).length) return { ok: false, errors }

  const entry = {
    id: newId(),
    target: targetId,
    // Todo en mayúsculas, salvo las opciones de listas desplegables, que ya son valores válidos.
    values: Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, target.fields.find((field) => field.name === key)?.type === 'select' ? value : uppercase(value)]),
    ),
    status: ALTA_STATUS.PENDING,
    createdAt: new Date().toISOString(),
    createdBy: CURRENT_USER,
  }
  applyEntry(entry)
  entries = [...entries, entry]
  persist()
  emit()
  return { ok: true, entry }
}

/** Acepta la creación: los SKU que usan estas altas dejan de estar bloqueados. */
export function acceptAltas(ids) {
  const wanted = new Set(ids)
  const at = new Date().toISOString()
  entries = entries.map((entry) =>
    wanted.has(entry.id) && entry.status === ALTA_STATUS.PENDING
      ? { ...entry, status: ALTA_STATUS.ACCEPTED, acceptedAt: at, acceptedBy: CURRENT_USER }
      : entry,
  )
  persist()
  emit()
}

/** Quita un alta pendiente (las aceptadas no se quitan desde la herramienta). */
export function removeAlta(id) {
  const entry = getAlta(id)
  if (!entry) return { ok: false, reason: 'No existe.' }
  if (entry.status !== ALTA_STATUS.PENDING) return { ok: false, reason: 'Solo se pueden quitar altas pendientes de aceptar.' }
  if (getTarget(entry.target)?.kind === 'marca') {
    const code = uppercase(entry.values.codigo)
    const dependent = entries.find((other) => other.id !== id && [`calota-${code}`, `grafica-${code}`].includes(other.target))
    if (dependent) return { ok: false, reason: 'Hay altas que dependen de esta marca: quitá esas primero.' }
  }
  unapplyEntry(entry)
  entries = entries.filter((other) => other.id !== id)
  persist()
  emit()
  return { ok: true }
}

/** Altas pendientes que usa una selección de un motor (o un genérico). */
export function pendingAltasUsed(engine, selections = {}, generico = null) {
  const ids = new Set()
  if (engine) {
    const brand = BRANDS.find((item) => item.id === engine.brand)
    if (brand?.alta) ids.add(brand.alta)
    engine.segments.forEach((segment) => {
      const value = selections[segment.id]
      if (segment.fixed || !value) return
      const options = segment.article ? segment.lines.flatMap((line) => line.items) : segment.getOptions(selections)
      options.filter((option) => option.code === value && option.alta).forEach((option) => ids.add(option.alta))
    })
  }
  if (generico?.alta) ids.add(generico.alta)
  return [...ids].filter(isPendingAlta).map(getAlta)
}

// ── Carga inicial y reinicio ──────────────────────────────

/** Vuelve al catálogo original (lo usan los tests). */
export function resetAltas() {
  ;[...entries].reverse().forEach(unapplyEntry)
  entries = []
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Sin almacenamiento: nada que borrar.
  }
  emit()
}

function loadStored() {
  let stored = []
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    stored = []
  }
  if (!Array.isArray(stored)) return
  // Las marcas primero: otras altas pueden apoyarse en ellas.
  const ordered = [...stored.filter((item) => item.target === 'marca'), ...stored.filter((item) => item.target !== 'marca')]
  entries = ordered.filter((entry) => entry?.id && entry.values && applyEntry(entry))
}

loadStored()
