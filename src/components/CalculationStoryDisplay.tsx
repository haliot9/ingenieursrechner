import type { CalculationStoryAlternative, CalculationStoryRow, CalculationStorySection, CalculationStoryState, StoryEquation, StoryOperation } from '../core/calculation-story'
import { renderLatex } from '../utils/latex'

type DisplayStory = Exclude<CalculationStoryState, { mode: 'not-applicable' }>

function safeLatex(latex: string): string { return latex.replaceAll('κ', '\\kappa').replaceAll('η', '\\eta').replaceAll('−', '-') }
function fallbackEquation(row: CalculationStoryRow): StoryEquation { const [lhs, ...rhsParts] = row.equationLatex.split('='); return { lhsLatex: lhs.trim(), relationLatex: '=', rhsLatex: rhsParts.join('=').trim() || row.equationLatex } }
function operationLatex(operation: CalculationStoryRow['operation']): string | undefined { if (!operation) return undefined; return typeof operation === 'string' ? `\\text{${operation}}` : (operation as StoryOperation).latex }
function MathFragment({ latex }: { latex: string }) { return <span dangerouslySetInnerHTML={{ __html: renderLatex(safeLatex(latex), false) }} /> }

function EquationRow({ row, index, alternatives }: { row: CalculationStoryRow; index: number; alternatives: readonly CalculationStoryAlternative[] }) {
  const equation = row.equation ?? fallbackEquation(row)
  const operation = operationLatex(row.operation)
  const attached = alternatives.filter(alternative => alternative.parentRowId === row.id)
  return <>
    <div className={`story-row story-spacing-${row.spacing ?? 'continuation'}`} data-story-row={row.kind} data-story-role={row.rowRole}>
      <div className="story-operation">{operation && <MathFragment latex={operation} />}</div>
      <div className={`story-equation-scroller story-equation-display${row.state ? ` is-${row.state}` : ''}${row.kind === 'numeric' ? ' is-numeric' : ''}`} aria-label={`Gleichungszeile ${index + 1}`} tabIndex={0}>
        <div className="story-equation-grid" data-long-equation={row.equationLatex.length > 64 ? 'true' : undefined}>
          <span className="story-bridge">{equation.bridgeLatex && <MathFragment latex={equation.bridgeLatex} />}</span>
          <span className="story-lhs">{equation.lhsLatex && <MathFragment latex={equation.lhsLatex} />}</span>
          <span className="story-relation"><MathFragment latex={equation.relationLatex} /></span>
          <span className="story-rhs"><MathFragment latex={equation.rhsLatex} /></span>
        </div>
      </div>
      <p className="story-note">{row.note ?? ''}</p>
    </div>
    {attached.map(alternative => <details className="story-parent-alternative" data-story-parent-alternative={row.id} key={`${row.id}-${alternative.title}`}><summary>{alternative.title}</summary>{alternative.rows.map((alternativeRow, alternativeIndex) => <EquationRow key={alternativeRow.id} row={alternativeRow} index={index + alternativeIndex + 1} alternatives={[]} />)}</details>)}
  </>
}

function StorySection({ section, index, alternatives }: { section: CalculationStorySection; index: number; alternatives: readonly CalculationStoryAlternative[] }) {
  const content = <>{section.rows.map((row, rowIndex) => <EquationRow row={row} index={index + rowIndex} key={`${section.id}-${row.id}-${rowIndex}`} alternatives={alternatives} />)}</>
  const tier = section.tier ?? 'main'
  if (tier === 'foundation' || tier === 'optional' || tier === 'alternative') return <details className="calculation-story-section story-disclosure" data-story-section={section.id} data-story-tier={tier} open={section.defaultOpen ?? tier === 'foundation'}><summary>{section.title}</summary>{content}</details>
  return <section className="calculation-story-section" data-story-section={section.id} data-story-tier={tier}><h3>{section.title}</h3>{content}</section>
}

export function CalculationStoryDisplay({ story }: { story: DisplayStory }) {
  if (story.mode === 'unavailable') return <section className="calculation-story calculation-story-unavailable" role="alert"><p className="eyebrow">Herleitung</p><h2>Herleitung nicht verfügbar</h2><p>{story.reason}</p></section>
  const sections = story.story.sections ?? [{ id: 'story', title: 'Herleitung', rows: story.story.rows }]
  const alternatives = story.story.alternatives ?? []
  const sectionIndices = sections.map((_, sectionIndex) => sections.slice(0, sectionIndex).reduce((count, previous) => count + previous.rows.length, 0))
  return <section className="calculation-story" aria-labelledby="calculation-story-title">
    <header className="calculation-story-heading"><p className="eyebrow">Herleitung</p><h2 id="calculation-story-title">{story.story.title}</h2><p>Die Rechenwerte stammen unverändert aus dem Solver. Der sichtbare Weg zeigt Modell, Bedingungen und Rechenschritte getrennt.</p></header>
    {story.story.overview && <section className="calculation-story-overview" aria-label="Rechenüberblick"><h3>Rechenüberblick</h3><p>{story.story.overview.model}</p><dl><div><dt>Gegeben</dt><dd>{story.story.overview.givens.join(', ')}</dd></div><div><dt>Geltung</dt><dd>{story.story.overview.scope}</dd></div><div><dt>Vorzeichen</dt><dd>{story.story.overview.signs.join(', ')}</dd></div><div><dt>Route</dt><dd>{story.story.overview.route.join(' → ')}</dd></div></dl></section>}
    <div className="calculation-story-spine" role="region" aria-label="Herleitung: Gleichungszeilen" tabIndex={0}>{sections.map((section, sectionIndex) => <StorySection key={section.id} section={section} index={sectionIndices[sectionIndex]} alternatives={alternatives} />)}</div>
  </section>
}
