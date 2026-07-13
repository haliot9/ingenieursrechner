import { useCalculatorStore } from '../../store/calculator-store'
import { PVDiagram } from './PVDiagram'
import { TSDiagram } from './TSDiagram'
import { convertValuesToModuleUnits } from '../../utils/module-values'

export function DiagramPanel() {
  const { module, values } = useCalculatorStore()

  // Modul hat keinen Adapter → keine Diagramme
  if (!module?.getDiagramSpec) return null

  const siValues = convertValuesToModuleUnits(module, values)
  const spec = module.getDiagramSpec(siValues)
  if (!spec) {
    return (
      <section className="diagram-section" aria-labelledby="diagram-title">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Visualisierung</p>
            <h2 id="diagram-title">Zustandsdiagramme</h2>
          </div>
        </div>
        <div className="empty-state">
          Trage mindestens zwei zusammenhängende Zustände ein oder lade den Referenzfall.
        </div>
      </section>
    )
  }

  // Pruefe ob genuegend Daten vorhanden fuer min. ein Diagramm
  const pvReady = spec.statePoints.filter(pt => pt.p !== null && pt.v !== null).length >= 2
  const tsReady = spec.statePoints.filter(pt => pt.T !== null && pt.s !== null).length >= 2
  if (!pvReady && !tsReady) return null

  return (
    <section className="diagram-section" aria-labelledby="diagram-title">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">Visualisierung</p>
          <h2 id="diagram-title">Zustandsdiagramme</h2>
        </div>
      </div>
      <div className="diagram-stack">
        {pvReady && <PVDiagram spec={spec} />}
        {tsReady && <TSDiagram spec={spec} />}
      </div>
    </section>
  )
}
