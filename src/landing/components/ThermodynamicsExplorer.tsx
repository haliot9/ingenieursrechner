import { useCallback, useMemo, useState } from 'react'
import { elasticMenuChainConfig } from '../motion/config/elastic-menu-chain-config.generated'
import {
  getThermodynamicsModules,
  type ThermodynamicsModuleId,
} from '../model/landing-modules'
import { buildReferenceScenario } from '../model/reference-scenario'
import { AnimatedContent } from './AnimatedContent'
import {
  AnimatedContentChain,
  type ElasticMenuChainPhase,
} from './AnimatedContentChain'
import { LandingDiagram } from './LandingDiagram'
import './ThermodynamicsExplorer.css'

export interface ThermodynamicsExplorerProps {
  readonly reducedMotion: boolean
  readonly onSelectionChange: (moduleId: ThermodynamicsModuleId) => void
  readonly onOpenCalculator: (moduleId: ThermodynamicsModuleId) => void
}

export function ThermodynamicsExplorer({
  reducedMotion,
  onSelectionChange,
  onOpenCalculator,
}: ThermodynamicsExplorerProps) {
  const modules = useMemo(() => getThermodynamicsModules(), [])
  const [expandedModuleId, setExpandedModuleId] = useState<ThermodynamicsModuleId | null>(null)
  const expandedModule = modules.find(module => module.id === expandedModuleId) ?? null
  const referenceScenario = useMemo(
    () => expandedModule ? buildReferenceScenario(expandedModule.id) : null,
    [expandedModule],
  )
  const { chain, profiles } = elasticMenuChainConfig
  const selectModule = (moduleId: ThermodynamicsModuleId) => {
    if (expandedModuleId === moduleId) {
      setExpandedModuleId(null)
      return
    }
    onSelectionChange(moduleId)
    setExpandedModuleId(moduleId)
  }
  const closeDetailOnReverse = useCallback((phase: ElasticMenuChainPhase) => {
    if (phase === 'reversing') setExpandedModuleId(null)
  }, [])

  return <section
    id="thermodynamik"
    className="thermodynamics-explorer"
    aria-label="Thermodynamik-Menü"
  >
    <AnimatedContentChain
      className="thermodynamics-menu"
      reducedMotion={reducedMotion}
      pullAtPreviousProgress={chain.pullAtPreviousProgress}
      threshold={chain.threshold}
      exitStartViewportPercent={chain.exitStartViewportPercent}
      layoutRevision={expandedModuleId ?? 'closed'}
      onPhaseChange={closeDetailOnReverse}
    >
      <AnimatedContent {...profiles.lead} className="thermodynamics-menu__lead">
        <article
          className="thermodynamics-menu__lead-surface"
          aria-labelledby="thermodynamics-menu-title"
        >
          <p className="landing-eyebrow">Aktives Fachgebiet</p>
          <h2 id="thermodynamics-menu-title">Thermodynamik</h2>
          <p>Vier nachvollziehbare Kreisprozess-Rechner.</p>
        </article>
      </AnimatedContent>

      {modules.map((module, index) => {
        const isExpanded = expandedModuleId === module.id
        const detailId = `thermodynamics-detail-${module.id}`
        const detailTitleId = `${detailId}-title`

        return <AnimatedContent
          key={module.id}
          {...profiles.follower}
          className="thermodynamics-menu__follower"
        >
          <button
            className="thermodynamics-menu__row"
            type="button"
            data-module-id={module.id}
            aria-expanded={isExpanded}
            aria-controls={isExpanded ? detailId : undefined}
            onClick={() => selectModule(module.id)}
          >
            <span className="thermodynamics-menu__number" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="thermodynamics-menu__copy">
              <strong>{module.name}</strong>
              <small>
                <span className="thermodynamics-menu__status-dot" aria-hidden="true" />
                Rechner verfügbar
              </small>
            </span>
            <span className="thermodynamics-menu__arrow" aria-hidden="true">↗</span>
          </button>

          {isExpanded && referenceScenario && <article
            id={detailId}
            className="thermodynamics-explorer__panel thermodynamics-explorer__panel--detail"
            role="region"
            aria-labelledby={detailTitleId}
          >
            <div className="thermodynamics-explorer__detail-copy">
              <p className="landing-eyebrow">Referenzfall Luft</p>
              <h3 id={detailTitleId}>{module.name}</h3>
              <p>{module.description}</p>
              <ol className="thermodynamics-explorer__processes" aria-label="Prozessfolge">
                {module.processSequence.map(process => <li key={process.transition}>
                  <span>{process.transition}</span>
                  <strong>{process.label}</strong>
                </li>)}
              </ol>
            </div>
            <LandingDiagram spec={referenceScenario.diagramSpec} />
            <div className="thermodynamics-explorer__detail-actions">
              <button
                type="button"
                className="thermodynamics-explorer__open"
                onClick={() => onOpenCalculator(module.id)}
              >
                Im Rechner öffnen
              </button>
            </div>
          </article>}
        </AnimatedContent>
      })}
    </AnimatedContentChain>
  </section>
}
