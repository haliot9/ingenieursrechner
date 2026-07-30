import { useState } from 'react'
import type { CalculationStoryAlternative, CalculationStoryRow, CalculationStorySection, CalculationStoryState, StoryEquation, StoryOperation, StorySupportRow } from '../core/calculation-story'
import { renderLatex } from '../utils/latex'

type DisplayStory = Exclude<CalculationStoryState, { mode: 'not-applicable' }>
type DisplayRow = CalculationStoryRow | StorySupportRow

function safeLatex(latex: string): string { return latex.replaceAll('κ', '\\kappa').replaceAll('η', '\\eta').replaceAll('→', '\\to').replaceAll('−', '-') }
function fallbackEquation(row: DisplayRow): StoryEquation {
  const [lhs, ...rhsParts] = row.equationLatex.split('=')
  return { lhsLatex: lhs.trim(), relationLatex: '=', rhsLatex: rhsParts.join('=').trim() || row.equationLatex }
}
function operationLatex(operation: DisplayRow['operation']): string | undefined {
  if (!operation) return undefined
  return typeof operation === 'string' ? operation : (operation as StoryOperation).latex
}
function MathFragment({ latex }: { latex: string }) { return <span dangerouslySetInnerHTML={{ __html: renderLatex(safeLatex(latex), true) }} /> }

function EquationRow({ row, index, alternatives, mainPathOnly, supportRow = false }: {
  row: DisplayRow
  index: number
  alternatives: readonly CalculationStoryAlternative[]
  mainPathOnly: boolean
  supportRow?: boolean
}) {
  if (row.kind === 'milestone') return <div className="story-milestone" data-story-role="milestone">✓ {row.label ?? row.equationLatex}</div>
  const currentEquation = row.equation ?? fallbackEquation(row)
  const currentOperation = operationLatex(row.operation)
  const attachedSupport = 'support' in row ? row.support : undefined
  const attached = alternatives.filter(alternative => alternative.parentRowId === row.id)
  const factClass = row.box === 'core' ? ' story-result-core' : row.box ? ` story-fact-${row.box}` : ''
  return <>
    <div
      className={`story-row${attachedSupport ? ' has-story-support' : ''}${supportRow ? ' story-support-row' : ''} story-spacing-${row.spacing ?? 'continuation'}`}
      data-story-row={row.kind}
      data-story-row-id={row.id}
      data-story-role={row.rowRole}
    >
      <div className="story-operation">{currentOperation && <MathFragment latex={currentOperation} />}</div>
      <div className={`story-equation-scroller story-equation-display${row.kind === 'numeric' ? ' is-numeric' : ''}`} aria-label={`Gleichungszeile ${index + 1}`} tabIndex={0}>
        <div className="story-equation-line">
          <span className="story-bridge">{currentEquation.bridgeLatex && <MathFragment latex={currentEquation.bridgeLatex} />}</span>
          <div className={`story-equation-grid${factClass}`} data-story-fact={row.box ?? undefined} data-long-equation={row.equationLatex.length > 64 ? 'true' : undefined}>
            <span className="story-lhs">{currentEquation.lhsLatex && <MathFragment latex={currentEquation.lhsLatex} />}</span>
            <span className="story-relation">{currentEquation.relationLatex && <MathFragment latex={currentEquation.relationLatex} />}</span>
            <span className="story-rhs"><MathFragment latex={currentEquation.rhsLatex} /></span>
          </div>
        </div>
      </div>
      <p className="story-note">{row.note ?? ''}</p>
      {attachedSupport && !mainPathOnly && (
        <details className="story-support" data-story-support={attachedSupport.id} data-story-parent-row={row.id} data-story-support-kind={attachedSupport.kind} open={attachedSupport.defaultOpen}>
          <summary>{attachedSupport.title}</summary>
          <div className="story-support-rows">
            {attachedSupport.rows.map((child, childIndex) => <EquationRow key={child.id} row={child} index={index + childIndex + 1} alternatives={[]} mainPathOnly={false} supportRow />)}
          </div>
        </details>
      )}
    </div>
    {attached.map(alternative => <details className="story-parent-alternative" data-story-parent-alternative={row.id} key={`${row.id}-${alternative.rows.map(candidate => candidate.id).join('|')}`}>
      <summary>{alternative.title}</summary>
      {alternative.rows.map((alternativeRow, alternativeIndex) => <EquationRow key={alternativeRow.id} row={alternativeRow} index={index + alternativeIndex + 1} alternatives={[]} mainPathOnly={false} />)}
    </details>)}
  </>
}

function StorySection({ section, index, alternatives, mainPathOnly }: {
  section: CalculationStorySection
  index: number
  alternatives: readonly CalculationStoryAlternative[]
  mainPathOnly: boolean
}) {
  const rows = section.rows.map((row, rowIndex) => <EquationRow row={row} index={index + rowIndex} key={`${section.id}-${row.id}-${rowIndex}`} alternatives={alternatives} mainPathOnly={mainPathOnly} />)
  const tier = section.tier ?? 'main'
  if (tier === 'foundation' || tier === 'optional' || tier === 'alternative') {
    return <details className="calculation-story-section story-disclosure" data-story-section={section.id} data-story-tier={tier} open={section.defaultOpen ?? tier === 'foundation'}><summary>{section.title}</summary>{rows}</details>
  }
  return <section className="calculation-story-section" data-story-section={section.id} data-story-tier={tier}><h3>{section.title}</h3>{rows}</section>
}

export function CalculationStoryDisplay({ story }: { story: DisplayStory }) {
  const [mainPathOnly, setMainPathOnly] = useState(false)
  if (story.mode === 'unavailable') return <section className="calculation-story calculation-story-unavailable" role="alert"><p className="eyebrow">Herleitung</p><h2>Herleitung nicht verfügbar</h2><p>{story.reason}</p></section>
  const sections = (story.story.sections ?? [{ id: 'story', title: 'Herleitung', rows: story.story.rows }]).filter(section => section.rows.length > 0)
  const alternatives = story.story.alternatives ?? []
  const sectionIndices = sections.map((_, sectionIndex) => sections.slice(0, sectionIndex).reduce((count, previous) => count + previous.rows.length, 0))
  return <section className="calculation-story" aria-labelledby="calculation-story-title" data-main-path-only={mainPathOnly}>
    <header className="calculation-story-heading">
      <div><p className="eyebrow">Herleitung</p><h2 id="calculation-story-title">{story.story.title}</h2><p>Modell, Bedingungen, strategische Rechenoperationen und ihre Begründungen bleiben am jeweiligen Rechenschritt sichtbar.</p></div>
      <div className="calculation-story-controls">
        <button type="button" aria-pressed={mainPathOnly} onClick={() => setMainPathOnly(value => !value)}>Nur Hauptpfad</button>
      </div>
    </header>
    {story.story.overview && <section className="calculation-story-overview" aria-label="Rechenüberblick"><h3>Rechenüberblick</h3><p>{story.story.overview.model}</p><dl><div><dt>Gegeben</dt><dd>{story.story.overview.givens.map((given, index) => <MathFragment key={index} latex={given} />)}</dd></div><div><dt>Geltung</dt><dd>{story.story.overview.scope}</dd></div><div><dt>Vorzeichen</dt><dd>{story.story.overview.signs.map((sign, index) => <MathFragment key={index} latex={sign} />)}</dd></div></dl></section>}
    <div className="calculation-story-spine" role="region" aria-label="Herleitung: Gleichungszeilen" tabIndex={0}>{sections.map((section, sectionIndex) => <StorySection key={section.id} section={section} index={sectionIndices[sectionIndex]} alternatives={alternatives} mainPathOnly={mainPathOnly} />)}</div>
  </section>
}
