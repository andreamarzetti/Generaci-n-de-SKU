import { useMemo, useRef, useState } from 'react'
import { ALL_EXISTING_SKUS } from '../data/realData'
import { nextArticleCode, usedArticleCodes } from '../engines/correlative'
import { brandHasGenericos, genericosFor, prefixBeforeArticle } from '../engines/engines'
import { buildEngineProposal, validateEngineRows } from '../engines/proposal'
import { useExternalLoad } from './useExternalLoad'

const LATENCY_MS = 650
const onlyDigits = (value = '') => String(value).replace(/\D/g, '')

function summarize(results) {
  const summary = { ok: 0, warn: 0, error: 0 }
  results?.forEach((row) => {
    summary[row.status] += 1
  })
  return summary
}

/**
 * Estado de la generación con un motor (marcas que no son LS2): segmentos elegidos,
 * artículo (de la tabla o correlativo nuevo), talles, validación mock y confirmación.
 * `confirmedItems` se comparte entre marcas para el control de duplicados de la sesión.
 */
export function useEngineGenerator(engine, { brandLabel, confirmedItems, onConfirmed, loadRequest = null, onLoadResult }) {
  const [selections, setSelections] = useState({})
  const [articleMode, setArticleMode] = useState('tabla')
  const [articleLine, setArticleLine] = useState('')
  const [articleManual, setArticleManual] = useState(null)
  const [sizes, setSizes] = useState([])
  const [descripcion, setDescripcion] = useState('')
  const [genericoKey, setGenericoKey] = useState('')
  const [rowData, setRowData] = useState({})
  const [validation, setValidation] = useState({ status: 'idle' })
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false)
  const [lastConfirmation, setLastConfirmation] = useState(null)
  const requestId = useRef(0)

  const session = useMemo(() => {
    const justConfirmed = new Set(lastConfirmation?.items.map((item) => item.sku))
    const previous = confirmedItems.filter((item) => !justConfirmed.has(item.sku))
    return { skus: previous.map((item) => item.sku), eans: previous.map((item) => item.ean).filter(Boolean) }
  }, [confirmedItems, lastConfirmation])

  // Artículo: de la tabla de la línea, o correlativo sugerido si el modelo es nuevo.
  const articlePrefix = prefixBeforeArticle(engine, selections)
  const usedArticles = useMemo(
    () => (articlePrefix ? usedArticleCodes(articlePrefix, [...ALL_EXISTING_SKUS, ...session.skus]) : new Set()),
    [articlePrefix, session],
  )
  const suggestedArticle = articlePrefix ? nextArticleCode(usedArticles) : null
  const hasArticle = engine.segments.some((segment) => segment.article)
  const articleValue = !hasArticle
    ? undefined
    : articleMode === 'nuevo'
      ? (articleManual ?? suggestedArticle ?? '')
      : (selections.articulo ?? '')
  const effectiveSelections = hasArticle ? { ...selections, articulo: articleValue } : selections

  const genericos = useMemo(() => genericosFor(engine, selections), [engine, selections])
  const generico = genericos.find((item) => item.key === genericoKey) ?? null
  const hasGenericos = brandHasGenericos(engine)

  const proposal = useMemo(
    () => buildEngineProposal(engine, { selections: effectiveSelections, sizes, descripcion, rowData }),
    [engine, effectiveSelections, sizes, descripcion, rowData],
  )

  const signature = JSON.stringify([
    engine.id,
    generico?.key ?? '',
    proposal.rows.map((row) => [row.key, row.sku, row.descripcion, rowData[row.key]?.ean ?? '']),
  ])
  const isStale = validation.status === 'done' && validation.signature !== signature
  const results = validation.status === 'done' && !isStale ? validation.results : null
  const summary = summarize(results)
  const isConfirmed = lastConfirmation?.signature === signature

  const canValidate = proposal.rows.length > 0
  const canConfirm =
    Boolean(results) && summary.error === 0 && (summary.warn === 0 || warningsAcknowledged) && !isConfirmed

  const stages = {
    data: (Boolean(generico) || !hasGenericos) && proposal.issues.length === 0 && proposal.rows.length > 0,
    proposal: proposal.rows.length > 0 && proposal.rows.every((row) => row.sku),
    validation: results ? (summary.error === 0 ? 'ok' : 'error') : validation.status === 'running' ? 'running' : 'pending',
    confirmation: isConfirmed,
  }

  const touch = () => setWarningsAcknowledged(false)

  const updateSelection = (segmentId, value) => {
    setSelections((prev) => {
      const next = { ...prev, [segmentId]: value }
      // La tipología depende de la familia.
      if (segmentId === 'familia') delete next.tipologia
      return next
    })
    touch()
  }

  const chooseArticleLine = (line) => {
    setArticleLine(line)
    setSelections((prev) => ({ ...prev, articulo: '' }))
    touch()
  }

  const chooseArticleMode = (mode) => {
    setArticleMode(mode)
    setArticleManual(null)
    touch()
  }

  const setArticleCode = (value) => {
    setArticleManual(value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 2))
    touch()
  }

  const toggleSize = (code) => {
    setSizes((prev) => (prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]))
    touch()
  }

  const updateRow = (rowKey, field, value) => {
    setRowData((prev) => {
      const row = { ...(prev[rowKey] ?? {}), [field]: value }
      if (value === undefined) delete row[field]
      return { ...prev, [rowKey]: row }
    })
    touch()
  }

  // Carga desde "Pegar solicitud": lo que no se puede deducir del mail queda para elegir.
  const hasData =
    Object.values(selections).some(Boolean) || sizes.length > 0 || Boolean(descripcion) || Boolean(genericoKey) || Object.keys(rowData).length > 0

  useExternalLoad(loadRequest, {
    applies: (request) => request.target === 'engine' && request.engineId === engine.id,
    hasData,
    apply: (payload) => {
      setSelections(payload.selections)
      setArticleMode('tabla')
      setArticleLine('')
      setArticleManual(null)
      setSizes(payload.sizes)
      setDescripcion(payload.descripcion.toUpperCase())
      setGenericoKey(payload.genericoKey)
      setRowData(payload.rowData)
      setLastConfirmation(null)
      requestId.current += 1
      setValidation({ status: 'idle' })
      setWarningsAcknowledged(false)
    },
    onLoadResult,
  })

  const clearForm = () => {
    setSelections({})
    setArticleMode('tabla')
    setArticleLine('')
    setArticleManual(null)
    setSizes([])
    setDescripcion('')
    setGenericoKey('')
    setRowData({})
    requestId.current += 1
    setValidation({ status: 'idle' })
    setWarningsAcknowledged(false)
  }

  const runValidation = async () => {
    if (!canValidate) return
    const id = ++requestId.current
    setWarningsAcknowledged(false)
    setValidation({ status: 'running' })
    await new Promise((resolve) => setTimeout(resolve, LATENCY_MS))
    const validated = validateEngineRows({ engine, proposal, rowData, generico, session })
    if (id !== requestId.current) return
    setValidation({ status: 'done', results: validated, signature })
  }

  const confirm = () => {
    if (!canConfirm) return
    const items = proposal.rows.map((row) => ({
      sku: row.sku,
      ean: onlyDigits(rowData[row.key]?.ean),
      descTango: row.descripcion,
      talle: row.size.code ? row.label : '',
      precio: '',
      generico: generico?.codigo ?? '',
    }))
    onConfirmed(items)
    setLastConfirmation({ signature, items, familyLabel: `${brandLabel} ${engine.label}`, at: new Date() })
  }

  const startNew = () => {
    setLastConfirmation(null)
    clearForm()
  }

  return {
    engine,
    selections,
    articleMode,
    articleLine,
    articleValue,
    articlePrefix,
    suggestedArticle,
    articleInUse: articleMode === 'nuevo' && Boolean(articleValue) && usedArticles.has(articleValue),
    sizes,
    descripcion,
    genericos,
    genericoKey,
    hasGenericos,
    rowData,
    proposal,
    validation: { status: isStale ? 'stale' : validation.status, results, summary },
    stages,
    warningsAcknowledged,
    canValidate,
    canConfirm,
    isConfirmed,
    lastConfirmation,
    actions: {
      updateSelection,
      chooseArticleLine,
      chooseArticleMode,
      setArticleCode,
      toggleSize,
      setDescripcion: (value) => {
        setDescripcion(value.toUpperCase())
        touch()
      },
      setGenericoKey: (value) => {
        setGenericoKey(value)
        touch()
      },
      updateRow,
      clearForm,
      runValidation,
      confirm,
      startNew,
      setWarningsAcknowledged,
    },
  }
}
