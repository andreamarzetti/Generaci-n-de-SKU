import { useMemo, useRef, useState } from 'react'
import { ALL_EXISTING_SKUS } from '../data/realData'
import { nextArticleCode, usedArticleCodes } from '../engines/correlative'
import { brandHasGenericos, genericosFor, prefixBeforeArticle } from '../engines/engines'
import { buildBatchProposal, buildEngineProposal, validateEngineRows } from '../engines/proposal'
import { pendingAltasUsed } from '../reference/store'
import { useAltas } from '../reference/useAltas'
import { genericExists, genericSkuOf } from '../rules/genericSku'
import { sameSizes, toggleInOrder } from '../rules/variantPlan'
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
  const altas = useAltas()
  const [selections, setSelections] = useState({})
  const [articleMode, setArticleMode] = useState('tabla')
  const [articleLine, setArticleLine] = useState('')
  const [articleManual, setArticleManual] = useState(null)
  const [sizes, setSizes] = useState([])
  const [descripcion, setDescripcion] = useState('')
  const [genericoKey, setGenericoKey] = useState('')
  const [rowData, setRowData] = useState({})
  // Carga masiva de varias variantes: { variants: [{ key, descripcion, selections, sizes }], curve }. Null = carga individual.
  const [batch, setBatch] = useState(null)
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

  // `altas` cambia cuando se crea o acepta un alta: hay que volver a leer los catálogos.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // En la carga masiva los genéricos salen de la tipología de las variantes (la de la primera).
  const genericSelections = batch ? (batch.variants[0]?.selections ?? {}) : selections
  const genericos = useMemo(() => genericosFor(engine, genericSelections), [engine, genericSelections, altas])
  const generico = genericos.find((item) => item.key === genericoKey) ?? null
  // Datos nuevos (sin aceptar) que usa lo armado: bloquean la confirmación.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pendingAltas = useMemo(() => {
    const used = batch
      ? batch.variants.flatMap((variant) => pendingAltasUsed(engine, variant.selections, generico))
      : pendingAltasUsed(engine, effectiveSelections, generico)
    return [...new Map(used.map((alta) => [alta.id, alta])).values()]
  }, [engine, effectiveSelections, generico, altas, batch])
  const hasGenericos = brandHasGenericos(engine)

  const proposal = useMemo(
    () =>
      batch
        ? buildBatchProposal(engine, { variants: batch.variants, curve: batch.curve, rowData })
        : buildEngineProposal(engine, { selections: effectiveSelections, sizes, descripcion, rowData }),
    [engine, effectiveSelections, sizes, descripcion, rowData, batch],
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
  // Los SKU que ya existen se omiten: no se crean ni van al resumen. El genérico ya existente se reutiliza.
  const omittedKeys = new Set((results ?? []).filter((row) => row.omit).map((row) => row.key))
  const nothingToCreate = Boolean(results) && proposal.rows.length > 0 && omittedKeys.size === proposal.rows.length
  // Qué se va a crear al confirmar: lo nuevo, lo que se omite por ya existir y los genéricos (nuevos o reutilizados).
  const failedKeys = new Set((results ?? []).filter((row) => row.status === 'error').map((row) => row.key))
  const creationSources = { existingSkus: ALL_EXISTING_SKUS, sessionSkus: new Set(session.skus) }
  const creation = results
    ? {
        // Lo nuevo sin problemas: no se omite y no tiene errores que lo bloqueen.
        create: proposal.rows.filter((row) => !omittedKeys.has(row.key) && !failedKeys.has(row.key) && row.sku).map((row) => row.sku),
        omit: proposal.rows.filter((row) => omittedKeys.has(row.key)).map((row) => row.sku),
        newGenerics: proposal.generics.filter((item) => !genericExists(item.sku, creationSources)).map((item) => item.sku),
        reusedGenerics: proposal.generics.filter((item) => genericExists(item.sku, creationSources)).map((item) => item.sku),
        blocked: summary.error,
      }
    : null
  const canConfirm =
    Boolean(results) &&
    summary.error === 0 &&
    (summary.warn === 0 || warningsAcknowledged) &&
    !isConfirmed &&
    pendingAltas.length === 0 &&
    !nothingToCreate

  const stages = {
    data: (Boolean(generico) || !hasGenericos || proposal.generics.length > 0) && proposal.issues.length === 0 && proposal.rows.length > 0,
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
    setArticleManual(
      value
        .toUpperCase()
        .replace(/[^0-9A-Z]/g, '')
        .slice(0, 2),
    )
    touch()
  }

  // Orden de la tabla de talles del motor (con "Sin talle" al final).
  const sizeOrder = [...engine.sizes.map((size) => size.code), ...(engine.allowNoSize ? [''] : [])]
  const updateBatch = (change) => {
    setBatch((prev) => (prev ? change(prev) : prev))
    touch()
  }
  const toggleBatchCurve = (code) => updateBatch((prev) => ({ ...prev, curve: toggleInOrder(prev.curve, code, sizeOrder) }))
  const setBatchVariantSizes = (key, sizes) =>
    updateBatch((prev) => ({
      ...prev,
      variants: prev.variants.map((variant) =>
        variant.key === key ? { ...variant, sizes: sameSizes(sizes, prev.curve) ? null : sizes } : variant,
      ),
    }))
  const resetBatchVariant = (key) =>
    updateBatch((prev) => ({
      ...prev,
      variants: prev.variants.map((variant) => (variant.key === key ? { ...variant, sizes: null } : variant)),
    }))
  const removeBatchVariant = (key) => {
    const variants = batch ? batch.variants.filter((variant) => variant.key !== key) : []
    setBatch(variants.length ? { ...batch, variants } : null)
    touch()
  }
  const exitBatch = () => {
    setBatch(null)
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
    Object.values(selections).some(Boolean) ||
    sizes.length > 0 ||
    Boolean(descripcion) ||
    Boolean(genericoKey) ||
    Object.keys(rowData).length > 0 ||
    Boolean(batch)

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
      setBatch(payload.batch ?? null)
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
    setBatch(null)
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
    const sources = { existingSkus: ALL_EXISTING_SKUS, sessionSkus: new Set(session.skus) }
    const toCreate = proposal.rows.filter((row) => !omittedKeys.has(row.key))
    const genericItems = proposal.generics.filter((item) => !genericExists(item.sku, sources)).map((item) => ({
      sku: item.sku,
      ean: '',
      descTango: item.descripcion,
      talle: '',
      precio: '',
      generico: item.sku,
      clasificacion: generico?.codigo ?? '',
      esGenerico: true,
    }))
    const items = toCreate.map((row) => ({
      sku: row.sku,
      ean: onlyDigits(rowData[row.key]?.ean),
      descTango: row.descripcion,
      talle: row.size.code ? row.label : '',
      precio: '',
      // Los SKU de la curva pertenecen a su SKU genérico (el mismo SKU sin talle).
      generico: genericSkuOf(row.sku) ?? generico?.codigo ?? '',
      clasificacion: generico?.codigo ?? '',
    }))
    const all = [...genericItems, ...items]
    onConfirmed(all)
    const omitted = proposal.rows.filter((row) => omittedKeys.has(row.key)).map((row) => row.sku)
    setLastConfirmation({ signature, items: all, omitted, familyLabel: `${brandLabel} ${engine.label}`, at: new Date() })
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
    nothingToCreate,
    creation,
    pendingAltas,
    batch,
    sizeOrder,
    pendingSkus: proposal.rows.map((row) => row.sku).filter(Boolean),
    isConfirmed,
    lastConfirmation,
    actions: {
      updateSelection,
      chooseArticleLine,
      chooseArticleMode,
      setArticleCode,
      toggleSize,
      toggleBatchCurve,
      setBatchVariantSizes,
      resetBatchVariant,
      removeBatchVariant,
      exitBatch,
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
