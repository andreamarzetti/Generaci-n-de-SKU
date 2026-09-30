import { PageHeader } from '../components/layout/PageHeader'
import { ActionBar } from '../components/sku/ActionBar'
import { AppliedRules } from '../components/sku/AppliedRules'
import { AuditCard } from '../components/sku/AuditCard'
import { BatchInput } from '../components/sku/BatchInput'
import { ConfirmationBanner } from '../components/sku/ConfirmationBanner'
import { FamilyFields } from '../components/sku/FamilyFields'
import { FamilySelector } from '../components/sku/FamilySelector'
import { GenericSelect } from '../components/sku/GenericSelect'
import { OutputPanel } from '../components/sku/OutputPanel'
import { ProcessStatus } from '../components/sku/ProcessStatus'
import { SkuComposition } from '../components/sku/SkuComposition'
import { SkuTable } from '../components/sku/SkuTable'
import { ValidationPanel } from '../components/sku/ValidationPanel'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useSkuGenerator } from '../hooks/useSkuGenerator'
import { FAMILY_LIST } from '../rules/families'
import { buildSteps } from './steps'

const DESCRIPTION_FIELD = {
  name: 'descripcion',
  label: 'Descripción',
  type: 'text',
  placeholder: 'Tal como la envía LS2',
  hint: 'De acá sale la descripción Tango de cada talle (editable en la tabla).',
}

const MODES = [
  { id: 'manual', label: 'Manual' },
  { id: 'lote', label: 'Pegar desde Excel' },
]

/** Generación de SKU para LS2: motor propio (sin cambios en la Etapa D). */
export function Ls2Workspace({ brandField, hidden = false }) {
  const sku = useSkuGenerator()
  const { family, form, proposal, validation, actions } = sku

  return (
    <main className="main" hidden={hidden}>
      <PageHeader
        title="Generación de SKU"
        subtitle="Armado, validación y confirmación de códigos en una sola pantalla."
      >
        <ProcessStatus steps={buildSteps(sku.stages)} />
      </PageHeader>

      <div className="layout">
        <div className="layout__side">
          <Card
            title="Datos del artículo"
            aside={
              <div className="card__actions">
                {sku.mode === 'manual' &&
                  sku.examples.map((example) => (
                    <Button key={example.id} size="sm" title={example.description} onClick={() => actions.loadExample(example.id)}>
                      {example.label}
                    </Button>
                  ))}
                <Button size="sm" variant="ghost" onClick={actions.clearForm}>
                  Limpiar
                </Button>
              </div>
            }
          >
            <div className="form">
              {brandField}
              <div className="field">
                <span className="field__label">Familia</span>
                <FamilySelector families={FAMILY_LIST} value={family.id} onChange={actions.selectFamily} />
              </div>
              <GenericSelect
                id={`${family.id}-generico`}
                genericos={sku.genericos}
                value={form.generico}
                onChange={(value) => actions.updateField('generico', value)}
              />

              <div className="tabs" role="tablist" aria-label="Forma de carga">
                {MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    role="tab"
                    aria-selected={sku.mode === mode.id}
                    className={`tabs__tab ${sku.mode === mode.id ? 'is-active' : ''}`}
                    onClick={() => actions.setMode(mode.id)}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {sku.mode === 'manual' ? (
                <FamilyFields
                  idPrefix={family.id}
                  fields={[DESCRIPTION_FIELD, ...family.fields]}
                  form={form}
                  onChange={actions.updateField}
                />
              ) : (
                <BatchInput
                  id={`${family.id}-lote`}
                  family={family}
                  text={sku.batchText}
                  preview={sku.batchPreview}
                  loaded={sku.batchLoaded}
                  onTextChange={actions.setBatchText}
                  onApply={actions.applyBatch}
                  onDiscard={actions.discardBatch}
                />
              )}
            </div>
          </Card>

          <AppliedRules family={family} />
        </div>

        <div className="layout__main">
          <SkuComposition
            segments={sku.segments}
            proposal={proposal}
            showFreeDigits={family.scheme === 'cascos'}
            onChooseFreeDigit={actions.chooseFreeDigit}
          />

          <SkuTable
            family={family}
            rows={proposal.rows}
            rowData={sku.rowData}
            results={validation.results}
            validationStatus={validation.status}
            onRowChange={actions.updateRow}
          />

          <ValidationPanel status={validation.status} results={validation.results} summary={validation.summary} />

          <OutputPanel
            family={family}
            classification={sku.classification}
            rows={proposal.rows}
            rowData={sku.rowData}
            results={validation.results}
          />

          {sku.isConfirmed ? (
            <ConfirmationBanner confirmation={sku.lastConfirmation} onStartNew={actions.startNew} />
          ) : (
            <ActionBar
              validationStatus={validation.status}
              summary={validation.summary}
              canValidate={sku.canValidate}
              canConfirm={sku.canConfirm}
              warningsAcknowledged={sku.warningsAcknowledged}
              onAcknowledge={actions.setWarningsAcknowledged}
              onValidate={actions.runValidation}
              onConfirm={actions.confirm}
            />
          )}

          <AuditCard />
        </div>
      </div>
    </main>
  )
}
