import type { CalculationStoryRow, CalculationStoryState, StoryEquation, StoryOperation } from '../core/calculation-story'
import { renderLatex } from '../utils/latex'

type DisplayStory = Exclude<CalculationStoryState, { mode: 'not-applicable' }>

function safeLatex(latex: string): string {
  return latex.replaceAll('κ', '\\kappa').replaceAll('η', '\\eta').replaceAll('−', '-')
}

function fallbackEquation(row: CalculationStoryRow): StoryEquation {
  const [lhs, ...rhsParts] = row.equationLatex.split('=')
  return { lhsLatex: lhs.trim(), relationLatex: '=', rhsLatex: rhsParts.join('=').trim() || row.equationLatex }
}

function operationLatex(operation: CalculationStoryRow['operation']): string | undefined {
  if (!operation) return undefined
  if (typeof operation === 'string') return `\\text{${operation}}`
  return (operation as StoryOperation).latex
}

function MathFragment({ latex }: { latex: string }) {
  return <span dangerouslySetInnerHTML={{ __html: renderLatex(safeLatex(latex), false) }} />
}

function EquationRow({ row, index }: { row: CalculationStoryRow; index: number }) {
  const equation = row.equation ?? fallbackEquation(row)
  const operation = operationLatex(row.operation)
  return <div className="story-row" data-story-row={row.kind} data-story-role={row.rowRole}>
    <div className="story-operation">{operation && <MathFragment latex={operation} />}</div>
    <div className={`story-equation-scroller${row.state ? ` is-${row.state}` : ''}${row.kind === 'numeric' ? ' is-numeric' : ''}`} aria-label={`Gleichungszeile ${index + 1}`} tabIndex={0}>
      <div className="story-equation-grid" data-long-equation={row.equationLatex.length > 64 ? 'true' : undefined}>
        <span className="story-bridge">{equation.bridgeLatex && <MathFragment latex={equation.bridgeLatex} />}</span>
        <span className="story-lhs">{equation.lhsLatex && <MathFragment latex={equation.lhsLatex} />}</span>
        <span className="story-relation"><MathFragment latex={equation.relationLatex} /></span>
        <span className="story-rhs"><MathFragment latex={equation.rhsLatex} /></span>
      </div>
    </div>
    <p className="story-note">{row.note ?? ''}</p>
  </div>
}

export function CalculationStoryDisplay({ story }: { story: DisplayStory }) {
  if (story.mode === 'unavailable') return <section className="calculation-story calculation-story-unavailable" role="alert"><p className="eyebrow">Herleitung</p><h2>Herleitung nicht verfügbar</h2><p>{story.reason}</p></section>
  return <section className="calculation-story" aria-labelledby="calculation-story-title">
    <header className="calculation-story-heading"><p className="eyebrow">Herleitung</p><h2 id="calculation-story-title">{story.story.title}</h2><p>Die Rechenwerte stammen unverändert aus dem Solver. Beziehungen, Umformungen und Prüfungen bleiben als nachvollziehbare Rechenkette getrennt.</p></header>
    <div className="calculation-story-spine" role="region" aria-label="Herleitung: Gleichungszeilen" tabIndex={0}>{story.story.rows.map((row, index) => <EquationRow row={row} index={index} key={row.id} />)}</div>
  </section>
}
