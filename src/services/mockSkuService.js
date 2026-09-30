// ─────────────────────────────────────────────────────────────
// SERVICIO MOCK. Simula la consulta a Tango con los datos reales de
// src/data/datosRealesTodasLasMarcas.json. Cuando exista la integración, se reemplaza
// este archivo manteniendo la misma firma.
// ─────────────────────────────────────────────────────────────
import { validateRows } from '../rules/validateRows'

const LATENCY_MS = 650
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function validateProposal(params) {
  await delay(LATENCY_MS)
  return validateRows(params)
}
