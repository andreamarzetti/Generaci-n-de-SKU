import { useState } from 'react'
import { EngineFields } from '../components/engine/EngineFields'
import { EngineSkuTable } from '../components/engine/EngineSkuTable'
import { PageHeader } from '../components/layout/PageHeader'
import { Wizard } from '../components/layout/Wizard'
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
            <Button size="sm" variant="ghost" onClick={actions.clearForm}>
              Limpiar
            </Button>
          </div>
        }
      >
        <div className="form">
          {brandField}
          {lineField}
          <EngineFields idPrefix={idPrefix} gen={gen} />
          <GenericSelect
            id={`${idPrefix}-generico`}
            genericos={gen.genericos}
            value={gen.genericoKey}
            onChange={actions.setGenericoKey}
            hint={
              gen.hasGenericos
                ? `Obligatorio. ${gen.genericos.length} genéricos de ${brand.label} para esta familia.`
                : 'Sin genéricos para esta marca.'
            }
            emptyMessage={
              gen.hasGenericos
                ? 'Elegí la familia o tipología para ver los genéricos.'
                : 'La marca no tiene genéricos cargados (a validar).'
            }
          />
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
          <PendingAltasNotice altas={gen.pendingAltas} skus={gen.pendingSkus} />
          <ActionBar
            pendingAltas={gen.pendingAltas.length}
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
        steps={buildSteps(gen.stages).map((item, index) => ({ ...item, content: content[index], narrow: index === 0 }))}
      />
    </main>
  )
}
