import { useMemo, useState } from 'react'
import {
  getThermodynamicsModules,
  type ThermodynamicsModuleId,
} from '../model/landing-modules'
import { buildReferenceScenario } from '../model/reference-scenario'
import { LandingDiagram } from './LandingDiagram'
import { LiquidSurface } from './LiquidSurface'
import './ThermodynamicsExplorer.css'

type ExplorerLayer = 'field' | 'branch' | 'cycles' | 'detail'

export interface ThermodynamicsExplorerProps {
  onSelectionChange: (moduleId: ThermodynamicsModuleId) => void
  onOpenCalculator: (moduleId: ThermodynamicsModuleId) => void
}

const PREVIOUS_LAYER: Record<Exclude<ExplorerLayer, 'field'>, ExplorerLayer> = {
  branch: 'field',
  cycles: 'branch',
  detail: 'cycles',
}

export function ThermodynamicsExplorer({
  onSelectionChange,
  onOpenCalculator,
}: ThermodynamicsExplorerProps) {
  const modules = useMemo(() => getThermodynamicsModules(), [])
  const [layer, setLayer] = useState<ExplorerLayer>('field')
  const [selectedId, setSelectedId] = useState<ThermodynamicsModuleId>('carnot')
  const selectedModule = modules.find(module => module.id === selectedId) ?? modules[0]
  const referenceScenario = useMemo(
    () => layer === 'detail' ? buildReferenceScenario(selectedId) : null,
    [layer, selectedId],
  )

  const selectModule = (moduleId: ThermodynamicsModuleId) => {
    setSelectedId(moduleId)
    onSelectionChange(moduleId)
    setLayer('detail')
  }

  const goBack = () => {
    if (layer !== 'field') setLayer(PREVIOUS_LAYER[layer])
  }

  return <section
    id="thermodynamik"
    className="thermodynamics-explorer"
    aria-label="Thermodynamik-Explorer"
  >
    <div className="thermodynamics-explorer__frame">
      <div className="thermodynamics-explorer__trail" aria-label="Aktueller Pfad">
        <span>Module</span>
        {layer !== 'field' && <><i aria-hidden="true">/</i><span>Thermodynamik</span></>}
        {(layer === 'cycles' || layer === 'detail') && <><i aria-hidden="true">/</i><span>Kreisprozesse</span></>}
        {layer === 'detail' && <><i aria-hidden="true">/</i><strong>{selectedModule.name}</strong></>}
      </div>

      <div className="thermodynamics-explorer__stage" aria-live="polite">
        {layer === 'field' && <div key="field" className="thermodynamics-explorer__panel thermodynamics-explorer__panel--intro">
          <p className="landing-eyebrow">Fachgebiet</p>
          <h2>Thermodynamik</h2>
          <p>Idealisierte Zustände, Energieflüsse und Kreisprozesse als nachvollziehbare Rechenmodelle.</p>
          <button type="button" className="thermodynamics-explorer__advance" onClick={() => setLayer('branch')}>
            Thermodynamik erkunden
          </button>
        </div>}

        {layer === 'branch' && <div key="branch" className="thermodynamics-explorer__panel thermodynamics-explorer__panel--intro">
          <p className="landing-eyebrow">Thermodynamik</p>
          <h2>Kreisprozesse</h2>
          <p>Vier geschlossene Modellzyklen zeigen, wie Prozessannahmen Zustände und Bilanz bestimmen.</p>
          <button type="button" className="thermodynamics-explorer__advance" onClick={() => setLayer('cycles')}>
            Kreisprozesse erkunden
          </button>
          <button type="button" className="thermodynamics-explorer__back" onClick={goBack}>Zurück</button>
        </div>}

        {layer === 'cycles' && <div key="cycles" className="thermodynamics-explorer__panel">
          <p className="landing-eyebrow">Thermodynamik · Kreisprozesse</p>
          <h2>Welcher Prozess soll sichtbar werden?</h2>
          <div className="thermodynamics-explorer__choices">
            {modules.map(module => <LiquidSurface
              key={module.id}
              className="thermodynamics-explorer__choice-surface"
            >
              <button
                type="button"
                aria-label={module.name}
                aria-pressed={selectedId === module.id}
                onClick={() => selectModule(module.id)}
              >
                <span>{module.name}</span>
                <small>{module.processSequence.map(process => process.transition).join(' · ')}</small>
              </button>
            </LiquidSurface>)}
          </div>
          <button type="button" className="thermodynamics-explorer__back" onClick={goBack}>Zurück</button>
        </div>}

        {layer === 'detail' && referenceScenario && <div key={`detail-${selectedId}`} className="thermodynamics-explorer__panel thermodynamics-explorer__panel--detail">
          <div className="thermodynamics-explorer__detail-copy">
            <p className="landing-eyebrow">Referenzfall Luft</p>
            <h2>{selectedModule.name}</h2>
            <p>{selectedModule.description}</p>
            <ol className="thermodynamics-explorer__processes" aria-label="Prozessfolge">
              {selectedModule.processSequence.map(process => <li key={process.transition}>
                <span>{process.transition}</span>
                <strong>{process.label}</strong>
              </li>)}
            </ol>
          </div>
          {referenceScenario.diagramSpec && <LandingDiagram spec={referenceScenario.diagramSpec} />}
          <div className="thermodynamics-explorer__detail-actions">
            <button type="button" className="thermodynamics-explorer__back" onClick={goBack}>Zurück</button>
            <button
              type="button"
              className="thermodynamics-explorer__open"
              onClick={() => onOpenCalculator(selectedId)}
            >
              Im Rechner öffnen
            </button>
          </div>
        </div>}
      </div>
    </div>
  </section>
}
