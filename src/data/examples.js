// Ejemplos precargables. Todos salen de casos reales: el paso a paso del 21/09
// o los artículos de datosRealesLS2.json. No se inventan códigos.
import { articlesBySupplierPrefix, findGenerico } from './realData'
import { normalizeSize } from '../rules/sizes'

/** Descripción del artículo sin el talle final ("FF808 ROAD BK TIT/RD MT S" → "FF808 ROAD BK TIT/RD MT"). */
function descriptionWithoutSize(description = '', rawSize = '') {
  const words = description.trim().split(/\s+/)
  const last = words.at(-1)
  if (last === rawSize || normalizeSize(last).recognized) words.pop()
  return words.join(' ')
}

/** Ejemplo de familia con talle a partir de los códigos de proveedor reales de un modelo. */
function fromSupplierPrefix(prefix) {
  const articles = articlesBySupplierPrefix(prefix)
  return {
    form: {
      descripcion: descriptionWithoutSize(articles[0]?.descripcion),
      generico: '',
      codigos: articles.map((article) => article.codigoProveedor).join('\n'),
    },
    rowData: Object.fromEntries(articles.map((article) => [article.codigoProveedor, { ean: article.ean ?? '' }])),
  }
}

function roadConflictExample() {
  const prefix = '168082307'
  const articles = articlesBySupplierPrefix(prefix)
  const talles = articles.map((article) => article.codigoProveedor.slice(prefix.length))
  return {
    form: {
      descripcion: descriptionWithoutSize(articles[0]?.descripcion, talles[0]),
      generico: '',
      talles,
    },
    // Códigos de barras vacíos a propósito: no están en los datos reales y no se inventan.
    rowData: Object.fromEntries(
      articles.map((article, index) => [normalizeSize(talles[index]).value, { ean: article.ean ?? '', barras: '' }]),
    ),
  }
}

const FUSION_GENERICO = findGenerico('LS2010806AB-GR|FUSION')

export const EXAMPLES = {
  cascos: [
    {
      id: 'nuevo',
      label: 'Ejemplo nuevo',
      description: 'Caso real del paso a paso del 21/09: se puede confirmar de punta a punta.',
      build: () => ({
        form: {
          descripcion: 'FF806 FUSION TECK LIGHT GRAY RED GLOSS',
          generico: FUSION_GENERICO?.key ?? '',
          talles: ['S', 'M', 'L', 'XL', '2X'],
        },
        rowData: {
          S: { barras: '9806002025011', ean: '6937449162997' },
          M: { barras: '9806002025010', ean: '6937449163000' },
          L: { barras: '9806002025009', ean: '6937449163017' },
          XL: { barras: '9806002025008', ean: '6937449163024' },
          '2X': { barras: '9806002025007', ean: '6937449163031' },
        },
      }),
    },
    {
      id: 'conflictos',
      label: 'Ejemplo con conflictos',
      description: 'FF808 ROAD (168082307): artículo existente, con XXL y 3XL a normalizar. Faltan los códigos de barras.',
      build: roadConflictExample,
    },
  ],
  indumentaria: [{ id: 'real', label: 'Cargar ejemplo real', description: 'Campera 64240W0112 (artículo existente).', build: () => fromSupplierPrefix('64240W0112') }],
  cordura: [{ id: 'real', label: 'Cargar ejemplo real', description: 'Pantalón 6201P1112 (artículo existente).', build: () => fromSupplierPrefix('6201P1112') }],
  guantes: [{ id: 'real', label: 'Cargar ejemplo real', description: 'Guante 70200W0164 (artículo existente).', build: () => fromSupplierPrefix('70200W0164') }],
  calzado: [{ id: 'real', label: 'Cargar ejemplo real', description: 'Calzado 71080C0112 (artículo existente).', build: () => fromSupplierPrefix('71080C0112') }],
  repuestos: [
    {
      id: 'real',
      label: 'Cargar ejemplo real',
      description: 'Repuesto 800562VIO01 (artículo existente).',
      build: () => {
        const [article] = articlesBySupplierPrefix('800562VIO01')
        return {
          form: { descripcion: article?.descripcion ?? '', generico: '', codigo: article?.codigoProveedor ?? '' },
          rowData: { unico: { ean: article?.ean ?? '' } },
        }
      },
    },
  ],
}
