import { useState } from 'react'
import { EngineFields } from '../components/engine/EngineFields'
import { EngineSkuTable } from '../components/engine/EngineSkuTable'
import { PageHeader } from '../components/layout/PageHeader'
import { Wizard } from '../components/layout/Wizard'
import { VariantPlanner } from '../components/sku/VariantPlanner'
import { CreationPreview } from '../components/reference/CreationPreview'
import { PendingAltasNotice } from '../components/reference/PendingAltasNotice'
import { ActionBar } from '../components/sku/ActionBar'
import { AppliedRulesInfo } from '../components/sku/AppliedRules'
import { AuditInfo } from '../components/sku/AuditInfo'
import { ConfirmationBanner } from '../components/sku/ConfirmationBanner'
import { GenericSelect } from '../components/sku/GenericSelect'
import { SkuComposition } from '../components/sku/SkuComposition'
import { ValidationPanel } from '../components/sku/ValidationPanel'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Field } from '../components/ui/Field'
import { ENGINE_GENERAL_RULES } from '../engines/engines'
import { ENGINE_CHECKS, engineRowSegments } from '../engines/proposal'
import { useEngineGenerator } from '../hooks/useEngineGenerator'
import { buildSteps } from './steps'

/** Talles del motor agrupados, para elegir la curva de la carga masiva. */
const planGroups = (engine) =>
  [...new Set(engine.sizes.map((size) => size.group))].map((label) => ({
    label,
    sizes: engine.sizes.filter((size) => size.group === label).map((size) => ({ code: size.code, label: size.label })),
  }))

/** Generación de SKU para las marcas que no son LS2, con el motor de la marca y la línea. */
export function EngineWorkspace({
  brand,
  engine,
  brandField,
  lineField,
  confirmedItems,
  onConfirmed,
  topSlot = null,
  loadRequest = null,
  onLoadResult,
  stepGuard = null,
}) {
  const gen = useEngineGenerator(engine, { brandLabel: brand.label, confirmedItems, onConfirmed, loadRequest, onLoadResult })
  const { proposal, validation, actions } = gen
  const idPrefix = engine.id
  const [step, setStep] = useState(0)
  const rulesInfo = <AppliedRulesInfo label={`${brand.label} · ${engine.label}`} rules={engine.rules} generalRules={ENGINE_GENERAL_RULES} />

  const content = [
    <>
      {topSlot}
      <Card
        title="Datos del artículo"
        info={rulesInfo}
        aside={
          <div className="card__actions">
            <Button size="sm" variant="danger" icon="eraser" onClick={actions.clearForm}>
              Limpiar
            </Button>
          </div>
        }
      >
        <div className="form">
          {brandField}
          {lineField}
          {gen.batch ? (
            <VariantPlanner
              idPrefix={idPrefix}
              variants={gen.batch.variants}
              curve={gen.batch.curve}
              sizeGroups={planGroups(engine)}
              allowNoSize={engine.allowNoSize}
              onToggleCurve={actions.toggleBatchCurve}
              onSaveVariantSizes={actions.setBatchVariantSizes}
              onResetVariant={actions.resetBatchVariant}
              onRemoveVariant={actions.removeBatchVariant}
              onExit={actions.exitBatch}
            />
          ) : (
            <EngineFields idPrefix={idPrefix} gen={gen} />
          )}
          <GenericSelect
            id={`${idPrefix}-generico`}
            genericos={gen.genericos}
            value={gen.genericoKey}
            onChange={actions.setGenericoKey}
            hint={
              gen.hasGenericos
                ? `Opcional con curva de talles (el SKU genérico se arma solo); sin curva es obligatorio. ${gen.genericos.length} códigos de ${brand.label} para esta familia.`
                : 'Sin genéricos para esta marca.'
            }
            emptyMessage={
              gen.hasGenericos
                ? 'Elegí la familia o tipología para ver los genéricos.'
                : 'La marca no tiene genéricos cargados (a validar).'
            }
          />
          {!gen.batch && (
            <Field
              label="Descripción (manual)"
              htmlFor={`${idPrefix}-descripcion`}
              hint="A validar: la generación automática queda para después. Se puede ajustar por talle en la tabla."
            >
              <input
                id={`${idPrefix}-descripcion`}
                className="input"
                value={gen.descripcion}
                placeholder="Descripción del artículo"
                onChange={(e) => actions.setDescripcion(e.target.value)}
              />
            </Field>
          )}
        </div>
      </Card>
    </>,
    <>
      <SkuComposition
        segments={proposal.segments}
        rowSegments={engineRowSegments(proposal)}
        proposal={proposal}
        showFreeDigits={false}
        onChooseFreeDigit={() => {}}
        info={rulesInfo}
      />
      <EngineSkuTable
        rows={proposal.rows}
        rowData={gen.rowData}
        results={validation.results}
        validationStatus={validation.status}
        onRowChange={actions.updateRow}
      />
    </>,
    <>
      <ValidationPanel
        status={validation.status}
        results={validation.results}
        summary={validation.summary}
        checks={ENGINE_CHECKS}
        rows={proposal.rows}
        info={<AuditInfo />}
      />

      {gen.isConfirmed ? (
        <ConfirmationBanner
          confirmation={gen.lastConfirmation}
          onStartNew={() => {
            actions.startNew()
            setStep(0)
          }}
        />
      ) : (
        <>
          <CreationPreview creation={gen.creation} />
          <PendingAltasNotice altas={gen.pendingAltas} skus={gen.pendingSkus} />
          <ActionBar
            pendingAltas={gen.pendingAltas.length}
          nothingToCreate={gen.nothingToCreate}
            validationStatus={validation.status}
            summary={validation.summary}
            canValidate={gen.canValidate}
            canConfirm={gen.canConfirm}
            warningsAcknowledged={gen.warningsAcknowledged}
            onAcknowledge={actions.setWarningsAcknowledged}
            onValidate={actions.runValidation}
            onConfirm={actions.confirm}
          />
        </>
      )}
    </>,
  ]

  return (
    <main className="main">
      <PageHeader title="Generación de SKU" />
      <Wizard
        current={step}
        onChange={setStep}
        guard={(from) => (from === 0 ? stepGuard : null)}
        steps={buildSteps(gen.stages).map((item, index) => ({ ...item, content: content[index], narrow: index === 0 }))}
      />
    </main>
  )
}
