/**
 * Clasificación propuesta en Tango: IMPORTADO › LS2 › Familia › Tipología › Modelo.
 * Solo se muestra; el formato exacto del árbol está A validar.
 * En cascos el modelo es el código + nombre tomados de la descripción del genérico
 * ("FF800 STORM KP GRAFICA" → "FF800 STORM"), como en el árbol real de Tango.
 */
export function buildClassification(family, generico) {
  if (!generico) return null
  return ['IMPORTADO', 'LS2', generico.familia, generico.tipologia, modelLabel(family, generico)]
}

function modelLabel(family, generico) {
  if (family.scheme !== 'cascos') return generico.modelo
  const code = generico.descripcion?.split(/\s+/)[0]
  return code && /\d/.test(code) ? `${code} ${generico.modelo}` : generico.modelo
}
