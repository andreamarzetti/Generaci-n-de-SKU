import { useMemo, useRef, useState } from 'react'
import { EXAMPLES } from '../data/examples'
import { EXISTING_SKUS, findGenerico, genericosForFamily, OFFICIAL_SIZES } from '../data/realData'
import { parseBatch } from '../rules/batch'
import { buildProposal, proposalSegments } from '../rules/buildProposal'
import { buildClassification } from '../rules/classification'
import { emptyForm, FAMILIES, FAMILY_LIST } from '../rules/families'
import { pendingAltasUsed } from '../reference/store'
import { useAltas } from '../reference/useAltas'
import { normalizeSize } from '../rules/sizes'
import { genericExists, genericSkuOf } from '../rules/genericSku'
import { ls2RowsFromPlan, sameSizes, toggleInOrder } from '../rules/variantPlan'
import { validateProposal } from '../services/mockSkuService'
import { useExternalLoad } from './useExternalLoad'

// Talles para la curva de la carga masiva (cascos).
const PLAN_SIZES = OFFICIAL_SIZES.filter((size) => size !== 'TU')
const initialForms = () => Object.fromEntries(FAMILY_LIST.map((family) => [family.id, emptyForm(family)]))
const onlyDigits = (value = '') => String(value).replace(/\D/g, '')

function summarize(results) {
  const summary = { ok: 0, warn: 0, error: 0 }
  results?.forEach((row) => {
    summary[row.status] += 1
  })
  return summary
}

/**
 * Estado completo de la pantalla de generación: familia, carga manual o por lote,
 * propuesta armada, validación (mock con datos reales) y confirmación.
 */
export function useSkuGenerator({ loadRequest = null, onLoadResult } = {}) {
  const altas = useAltas()
  const [familyId, setFamilyId] = useState('cascos')
  const [forms, setForms] = useState(initialForms)
  const [modeByFamily, setModeByFamily] = useState({})
  const [batchTextByFamily, setBatchTextByFamily] = useState({})
  const [batchByFamily, setBatchByFamily] = useState({})
  // Carga masiva de varias variantes con una curva de talles: { variants: [{ key, descripcion, sizes }], curve }.
  const [planByFamily, setPlanByFamily] = useState({})
  const [rowDataByFamily, setRowDataByFamily] = useState({})
  const [freeDigitChoice, setFreeDigitChoice] = useState({})
  const [validation, setValidation] = useState({ status: 'idle' })
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false)
  const [confirmedItems, setConfirmedItems] = useState([])
  const [lastConfirmation, setLastConfirmation] = useState(null)
  const requestId = useRef(0)

  const family = FAMILIES[familyId]
  const form = forms[familyId]
  const mode = modeByFamily[familyId] ?? 'manual'
  const batchText = batchTextByFamily[familyId] ?? ''
  const plan = planByFamily[familyId] ?? null
  const planRows = useMemo(() => (plan ? ls2RowsFromPlan(plan, normalizeSize) : null), [plan])
  const batchRows = mode === 'lote' ? (planRows ?? batchByFamily[familyId] ?? null) : null
  const batchPreview = useMemo(() => parseBatch(batchText, family), [batchText, family])
  const rowData = useMemo(() => rowDataByFamily[familyId] ?? {}, [rowDataByFamily, familyId])
  // `altas` cambia cuando se crea o acepta un alta: hay que volver a leer los genéricos.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const genericos = useMemo(() => genericosForFamily(family.familia), [family, altas])
  const generico = findGenerico(form.generico)
  const pendingAltas = useMemo(() => pendingAltasUsed(null), [altas])

  // Lo confirmado en la sesión cuenta como usado, salvo el lote recién confirmado
  // mientras se muestra, para que la propuesta no cambie debajo.
  const session = useMemo(() => {
    const justConfirmed = new Set(lastConfirmation?.items.map((item) => item.sku))
    const previous = confirmedItems.filter((item) => !justConfirmed.has(item.sku))
    return { skus: previous.map((item) => item.sku), eans: previous.map((item) => item.ean).filter(Boolean) }
  }, [confirmedItems, lastConfirmation])

  const proposal = useMemo(
    () =>
      buildProposal(
        family,
        { form, batchRows, rowData },
        {
          freeDigitSources: [
            { label: 'artículos LS2', skus: EXISTING_SKUS },
            { label: 'sesión', skus: session.skus },
          ],
          freeDigitChoices: freeDigitChoice,
        },
      ),
    [family, form, batchRows, rowData, session, freeDigitChoice],
  )
  const segments = proposalSegments(family, proposal)
  const rowSegments = proposal.rows.map((row) => ({ row, segments: proposalSegments(family, proposal, row) }))
  const classification = buildClassification(family, generico)

  const signature = JSON.stringify([
    familyId,
    form.generico,
    proposal.rows.map((row) => [row.key, row.sku, row.tango.text, rowData[row.key] ?? {}]),
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
  const creationSources = { existingSkus: EXISTING_SKUS, sessionSkus: new Set(session.skus) }
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

  // Etapas: cada una se completa recién cuando se cumple su condición.
  const dataComplete =
    (Boolean(generico) || proposal.generics.length > 0) &&
    proposal.rows.length > 0 &&
    proposal.rows.every((row) => {
      const data = rowData[row.key] ?? {}
      const barcodeOk = family.scheme !== 'cascos' || onlyDigits(data.barras).length >= 7
      return barcodeOk && onlyDigits(data.ean).length > 0 && !row.parseErrors?.length
    })
  const proposalComplete = proposal.rows.length > 0 && proposal.rows.every((row) => row.sku)
  const stages = {
    data: dataComplete,
    proposal: proposalComplete,
    validation: results ? (summary.error === 0 ? 'ok' : 'error') : validation.status === 'running' ? 'running' : 'pending',
    confirmation: isConfirmed,
  }

  const resetValidation = () => {
    requestId.current += 1
    setValidation({ status: 'idle' })
    setWarningsAcknowledged(false)
  }

  const setFamilyState = (setter, value) => setter((prev) => ({ ...prev, [familyId]: value }))

  const selectFamily = (id) => {
    if (id === familyId) return
    setFamilyId(id)
    resetValidation()
  }

  const setMode = (next) => {
    if (next === mode) return
    setFamilyState(setModeByFamily, next)
    setLastConfirmation(null)
    resetValidation()
  }

  const updateField = (name, value) => {
    setForms((prev) => ({ ...prev, [familyId]: { ...prev[familyId], [name]: value } }))
    setWarningsAcknowledged(false)
  }

  const updateRow = (rowKey, field, value) => {
    setRowDataByFamily((prev) => {
      const current = prev[familyId] ?? {}
      const row = { ...(current[rowKey] ?? {}), [field]: value }
      if (value === undefined) delete row[field]
      return { ...prev, [familyId]: { ...current, [rowKey]: row } }
    })
    setWarningsAcknowledged(false)
  }

  const chooseFreeDigit = (groupKey, value) => {
    setFreeDigitChoice((prev) => ({ ...prev, [groupKey]: value }))
  }

  const setBatchText = (text) => setFamilyState(setBatchTextByFamily, text)

  /** Carga las filas leídas del bloque pegado en la tabla de SKUs (siguen siendo editables). */
  const applyBatch = () => {
    if (batchPreview.rows.length === 0) return
    setFamilyState(setBatchByFamily, batchPreview.rows)
    setFamilyState(setRowDataByFamily, Object.fromEntries(batchPreview.rows.map((row) => [row.key, { barras: row.barras, ean: row.ean }])))
    setLastConfirmation(null)
    resetValidation()
  }

  const updatePlan = (change) => {
    setPlanByFamily((prev) => (prev[familyId] ? { ...prev, [familyId]: change(prev[familyId]) } : prev))
    resetValidation()
  }
  const togglePlanCurve = (code) => updatePlan((current) => ({ ...current, curve: toggleInOrder(current.curve, code, PLAN_SIZES) }))
  const setPlanVariantSizes = (key, sizes) =>
    updatePlan((current) => ({
      ...current,
      variants: current.variants.map((variant) =>
        variant.key === key ? { ...variant, sizes: sameSizes(sizes, current.curve) ? null : sizes } : variant,
      ),
    }))
  const resetPlanVariant = (key) =>
    updatePlan((current) => ({
      ...current,
      variants: current.variants.map((variant) => (variant.key === key ? { ...variant, sizes: null } : variant)),
    }))
  const exitPlan = () => {
    setFamilyState(setPlanByFamily, null)
    setFamilyState(setModeByFamily, 'manual')
    setFamilyState(setRowDataByFamily, {})
    setLastConfirmation(null)
    resetValidation()
  }
  const removePlanVariant = (key) => {
    const variants = plan ? plan.variants.filter((variant) => variant.key !== key) : []
    if (variants.length === 0) exitPlan()
    else updatePlan((current) => ({ ...current, variants }))
  }

  const discardBatch = () => {
    setFamilyState(setPlanByFamily, null)
    setFamilyState(setBatchByFamily, null)
    setFamilyState(setRowDataByFamily, {})
    resetValidation()
  }

  const loadExample = (exampleId) => {
    const example = EXAMPLES[familyId]?.find((item) => item.id === exampleId)
    if (!example) return
    const { form: exampleForm, rowData: exampleRows } = example.build()
    setForms((prev) => ({ ...prev, [familyId]: { ...emptyForm(family), ...exampleForm } }))
    setFamilyState(setModeByFamily, 'manual')
    setFamilyState(setRowDataByFamily, exampleRows)
    setLastConfirmation(null)
    resetValidation()
  }

  // Carga desde "Pegar solicitud": familia, datos del artículo y filas por talle.
  const formHasData = (familyKey) => {
    const current = forms[familyKey]
    const filled = Object.values(current).some((value) => (Array.isArray(value) ? value.length > 0 : Boolean(value)))
    return (
      filled ||
      Object.keys(rowDataByFamily[familyKey] ?? {}).length > 0 ||
      Boolean(batchByFamily[familyKey]) ||
      Boolean(planByFamily[familyKey])
    )
  }

  useExternalLoad(loadRequest, {
    applies: (request) => request.target === 'ls2',
    hasData: loadRequest?.target === 'ls2' ? formHasData(loadRequest.payload.familyId) : false,
    apply: ({ familyId: targetFamily, form: loadedForm, rowData: loadedRows, plan: loadedPlan }) => {
      setFamilyId(targetFamily)
      setForms((prev) => ({ ...prev, [targetFamily]: { ...emptyForm(FAMILIES[targetFamily]), ...loadedForm } }))
      // Con varias variantes se abre la carga masiva con su curva de talles; si no, la carga uno por uno.
      setModeByFamily((prev) => ({ ...prev, [targetFamily]: loadedPlan ? 'lote' : 'manual' }))
      setBatchByFamily((prev) => ({ ...prev, [targetFamily]: null }))
      setPlanByFamily((prev) => ({ ...prev, [targetFamily]: loadedPlan ?? null }))
      setRowDataByFamily((prev) => ({ ...prev, [targetFamily]: loadedRows }))
      setLastConfirmation(null)
      resetValidation()
    },
    onLoadResult,
  })

  const clearForm = () => {
    setForms((prev) => ({ ...prev, [familyId]: emptyForm(family) }))
    setFamilyState(setRowDataByFamily, {})
    setFamilyState(setBatchByFamily, null)
    setFamilyState(setPlanByFamily, null)
    setFamilyState(setBatchTextByFamily, '')
    resetValidation()
  }

  const runValidation = async () => {
    if (!canValidate) return
    const id = ++requestId.current
    setWarningsAcknowledged(false)
    setValidation({ status: 'running' })
    const validated = await validateProposal({ family, proposal, rowData, generico, session })
    if (id !== requestId.current) return
    setValidation({ status: 'done', results: validated, signature })
  }

  const confirm = () => {
    if (!canConfirm) return
    const sources = { existingSkus: EXISTING_SKUS, sessionSkus: new Set(session.skus) }
    const toCreate = proposal.rows.filter((row) => !omittedKeys.has(row.key))
    const genericItems = proposal.generics.filter((item) => !genericExists(item.sku, sources)).map((item) => ({
      sku: item.sku,
      ean: '',
      descTango: item.descripcion,
      gs1: '',
      talle: '',
      precio: '',
      generico: item.sku,
      clasificacion: generico?.codigo ?? '',
      familyId,
      esGenerico: true,
    }))
    const items = toCreate.map((row) => ({
      sku: row.sku,
      ean: onlyDigits(rowData[row.key]?.ean),
      descTango: row.tango.text,
      gs1: row.gs1,
      talle: row.size?.value ?? '',
      precio: rowData[row.key]?.precio ?? '',
      // Los SKU de la curva pertenecen a su SKU genérico (el mismo SKU sin talle).
      generico: genericSkuOf(row.sku) ?? generico?.codigo ?? '',
      clasificacion: generico?.codigo ?? '',
      familyId,
    }))
    const all = [...genericItems, ...items]
    setConfirmedItems((prev) => [...prev, ...all])
    const omitted = proposal.rows.filter((row) => omittedKeys.has(row.key)).map((row) => row.sku)
    setLastConfirmation({ signature, items: all, omitted, familyLabel: family.label, at: new Date() })
  }

  const startNew = () => {
    setLastConfirmation(null)
    clearForm()
  }

  return {
    family,
    form,
    mode,
    batchText,
    batchPreview,
    batchLoaded: Boolean(batchRows),
    plan,
    planSizes: PLAN_SIZES,
    rowData,
    genericos,
    generico,
    classification,
    proposal,
    segments,
    rowSegments,
    examples: EXAMPLES[familyId] ?? [],
    validation: {
      status: isStale ? 'stale' : validation.status,
      results,
      summary,
    },
    stages,
    warningsAcknowledged,
    canValidate,
    canConfirm,
    nothingToCreate,
    creation,
    pendingAltas,
    pendingSkus: proposal.rows.map((row) => row.sku).filter(Boolean),
    isConfirmed,
    lastConfirmation,
    actions: {
      selectFamily,
      setMode,
      updateField,
      updateRow,
      chooseFreeDigit,
      setBatchText,
      applyBatch,
      discardBatch,
      togglePlanCurve,
      setPlanVariantSizes,
      resetPlanVariant,
      removePlanVariant,
      exitPlan,
      loadExample,
      clearForm,
      runValidation,
      confirm,
      startNew,
      setWarningsAcknowledged,
    },
  }
}
