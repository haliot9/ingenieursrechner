import type { DiagramSpec } from '../../core/types'
import { TSDiagram } from '../../components/diagrams/TSDiagram'

export function LandingDiagram({ spec }: { spec: DiagramSpec }) {
  return <div className="landing-diagram" aria-label="Referenzdiagramm">
    <TSDiagram spec={spec} />
  </div>
}
