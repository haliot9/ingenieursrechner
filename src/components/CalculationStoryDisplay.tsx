import { useState, type Ref } from 'react'
import type { CalculationStoryAlternative, CalculationStoryRow, CalculationStorySection, CalculationStoryState, StoryEquation, StoryOperation, StorySupportRow } from '../core/calculation-story'
import { renderLatex } from '../utils/latex'

type DisplayStory = Exclude<CalculationStoryState, { mode: 'not-applicable' }>
type DisplayRow = CalculationStoryRow | StorySupportRow

function safeLatex(latex: string): string { return latex.replaceAll('κ', '\\kappa').replaceAll('η', '\\eta').replaceAll('−', '-') }
function fallbackEquation(row: DisplayRow): StoryEquation { const [lhs, ...rhsParts] = row.equationLatex.split('='); return { lhsLatex: lhs.trim(), relationLatex: '=', rhsLatex: rhsParts.join('=').trim() || row.equationLatex } }
function operationLatex(operation: DisplayRow['operation']): string | undefined { if (!operation) return undefined; return typeof operation === 'string' ? `\\text{${operation}}` : (operation as StoryOperation).latex }
function MathFragment({ latex }: { latex: string }) { return <span dangerouslySetInnerHTML={{ __html: renderLatex(safeLatex(latex), true) }} /> }

function EquationRow({ row, index, alternatives, mainPathOnly, supportRow = false }: { row: DisplayRow; index: number; alternatives: readonly CalculationStoryAlternative[]; mainPathOnly: boolean; supportRow?: boolean }) {
  if (row.kind === 'milestone') return <div className="story-milestone" data-story-role="milestone">✓ {row.label ?? row.equationLatex}</div>
  const equation = row.equation ?? fallbackEquation(row)
  const operation = operationLatex(row.operation)
  const support = 'support' in row ? row.support : undefined
  const attachedPayload = (alternative: CalculationStoryAlternative) => `${alternative.parentRowId}|${alternative.rows.map(candidate => { const candidateEquation = candidate.equation ?? fallbackEquation(candidate); return `${candidateEquation.lhsLatex ?? ''}|${candidateEquation.relationLatex}|${candidateEquation.rhsLatex}|${candidate.note ?? ''}` }).join('||')}`
  const attached = alternatives.filter(alternative => alternative.parentRowId === row.id).filter((alternative, alternativeIndex, all) => all.findIndex(candidate => attachedPayload(candidate) === attachedPayload(alternative)) === alternativeIndex)
  return <>
    <div className={`story-row${support ? ' has-story-support' : ''}${supportRow ? ' story-support-row' : ''} story-spacing-${row.spacing ?? 'continuation'}`} data-story-row={row.kind} data-story-row-id={row.id} data-story-role={row.rowRole}>
      <div className="story-operation">{operation && <MathFragment latex={operation} />}</div>
      <div className={`story-equation-scroller story-equation-display${row.state && row.box !== 'core' ? ` is-${row.state}` : ''}${row.kind === 'numeric' ? ' is-numeric' : ''}`} aria-label={`Gleichungszeile ${index + 1}`} tabIndex={0}>
        <div className="story-equation-line"><span className="story-bridge">{equation.bridgeLatex && <MathFragment latex={equation.bridgeLatex} />}</span><div className={`story-equation-grid${row.box === 'core' ? ' story-result-core' : ''}`} data-long-equation={row.equationLatex.length > 64 ? 'true' : undefined}><span className="story-lhs">{equation.lhsLatex && <MathFragment latex={equation.lhsLatex} />}</span><span className="story-relation"><MathFragment latex={equation.relationLatex} /></span><span className="story-rhs"><MathFragment latex={equation.rhsLatex} /></span></div></div>
      </div>
      <p className="story-note">{row.note ?? ''}</p>
      {support && !mainPathOnly && <details className="story-support" data-story-support={support.id} data-story-parent-row={row.id} data-story-support-kind={support.kind} open={support.defaultOpen}><summary>{support.title}</summary><div className="story-support-rows">{support.rows.map((supportRow, supportIndex) => <EquationRow key={supportRow.id} row={supportRow} index={index + supportIndex + 1} alternatives={[]} mainPathOnly={false} supportRow />)}</div></details>}
    </div>
    {attached.map(alternative => <details className="story-parent-alternative" data-story-parent-alternative={row.id} key={`${row.id}-${alternative.rows.map(row => row.id).join('|')}`}><summary>{alternative.title}</summary>{alternative.rows.map((alternativeRow, alternativeIndex) => <EquationRow key={alternativeRow.id} row={alternativeRow} index={index + alternativeIndex + 1} alternatives={[]} mainPathOnly={false} />)}</details>)}
  </>
}

function StorySection({ section, index, alternatives, mainPathOnly }: { section: CalculationStorySection; index: number; alternatives: readonly CalculationStoryAlternative[]; mainPathOnly: boolean }) {
  const content = <>{section.rows.map((row, rowIndex) => <EquationRow row={row} index={index + rowIndex} key={`${section.id}-${row.id}-${rowIndex}`} alternatives={alternatives} mainPathOnly={mainPathOnly} />)}</>
  const tier = section.tier ?? 'main'
  if (tier === 'foundation' || tier === 'optional' || tier === 'alternative') return <details className="calculation-story-section story-disclosure" data-story-section={section.id} data-story-tier={tier} open={section.defaultOpen ?? tier === 'foundation'}><summary>{section.title}</summary>{content}</details>
  return <section className="calculation-story-section" data-story-section={section.id} data-story-tier={tier}><h3>{section.title}</h3>{content}</section>
}

export function CalculationStoryDisplay({ story, focused = false, onToggleFocus, focusControlRef }: { story: DisplayStory; focused?: boolean; onToggleFocus?: () => void; focusControlRef?: Ref<HTMLButtonElement> }) {
  const [mainPathOnly, setMainPathOnly] = useState(false)
  if (story.mode === 'unavailable') return <section className="calculation-story calculation-story-unavailable" role="alert"><p className="eyebrow">Herleitung</p><h2>Herleitung nicht verfügbar</h2><p>{story.reason}</p></section>
  const sections = (story.story.sections ?? [{ id: 'story', title: 'Herleitung', rows: story.story.rows }]).filter(section => section.rows.length > 0)
  const alternatives = story.story.alternatives ?? []
  const sectionIndices = sections.map((_, sectionIndex) => sections.slice(0, sectionIndex).reduce((count, previous) => count + previous.rows.length, 0))
  return <section className="calculation-story" aria-labelledby="calculation-story-title">
    <header className="calculation-story-heading"><div><p className="eyebrow">Herleitung</p><h2 id="calculation-story-title">{story.story.title}</h2><p>Die Rechenwerte stammen unverändert aus dem Solver. Der sichtbare Weg zeigt Modell, Bedingungen und Rechenschritte getrennt.</p></div><div className="calculation-story-controls"><button type="button" aria-pressed={mainPathOnly} onClick={() => setMainPathOnly(value => !value)}>Main path only</button>{onToggleFocus && <button type="button" ref={focusControlRef} data-calculation-story-focus-control aria-label={focused ? 'Leave calculation story focus' : 'Focus calculation story'} aria-pressed={focused} onClick={onToggleFocus}>{focused ? 'Focus verlassen' : 'Rechenweg fokussieren'}</button>}</div></header>
    {story.story.overview && <section className="calculation-story-overview" aria-label="Rechenüberblick"><h3>Rechenüberblick</h3><p>{story.story.overview.model}</p><dl><div><dt>Gegeben</dt><dd>{story.story.overview.givens.map((given, index) => <MathFragment key={index} latex={given} />)}</dd></div><div><dt>Geltung</dt><dd>{story.story.overview.scope}</dd></div><div><dt>Vorzeichen</dt><dd>{story.story.overview.signs.map((sign, index) => <MathFragment key={index} latex={sign} />)}</dd></div><div><dt>Route</dt><dd>{story.story.overview.route.join(' → ')}</dd></div></dl></section>}
    <div className="calculation-story-spine" role="region" aria-label="Herleitung: Gleichungszeilen" tabIndex={0}>{sections.map((section, sectionIndex) => <StorySection key={section.id} section={section} index={sectionIndices[sectionIndex]} alternatives={alternatives} mainPathOnly={mainPathOnly} />)}</div>
  </section>
}
