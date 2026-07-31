import { Fragment, useRef, useState } from 'react'
import type { CalculationStoryAlternative, CalculationStoryRow, CalculationStorySection, CalculationStoryState, CalculationStorySupport, StoryEquation, StoryOperation, StorySupportRow } from '../core/calculation-story'
import { renderLatex } from '../utils/latex'

type DisplayStory = Exclude<CalculationStoryState, { mode: 'not-applicable' }>
type DisplayRow = CalculationStoryRow | StorySupportRow

function safeLatex(latex: string): string {
  return latex.replaceAll('κ', '\\kappa').replaceAll('η', '\\eta').replaceAll('→', '\\to').replaceAll('−', '-')
}

function fallbackEquation(row: DisplayRow): StoryEquation {
  const [lhs, ...rhsParts] = row.equationLatex.split('=')
  return { lhsLatex: lhs.trim(), relationLatex: '=', rhsLatex: rhsParts.join('=').trim() || row.equationLatex }
}

function operationLatex(operation: DisplayRow['operation']): string | undefined {
  if (!operation) return undefined
  return typeof operation === 'string' ? operation : (operation as StoryOperation).latex
}

function MathFragment({ latex }: { latex: string }) {
  return <span dangerouslySetInnerHTML={{ __html: renderLatex(`\\displaystyle ${safeLatex(latex)}`, false) }} />
}

function supportHeading(support: CalculationStorySupport): { kind: string; title: string } {
  const [kind, ...title] = support.title.split('·').map(part => part.trim())
  return { kind: kind || support.kind, title: title.join(' · ') || kind || support.kind }
}

function ProofRows({ support }: { support: CalculationStorySupport }) {
  return <div className="story-proof-grid">
    {support.rows.map(row => {
      const currentEquation = row.equation ?? fallbackEquation(row)
      const currentOperation = operationLatex(row.operation)
      return <Fragment key={row.id}>
        <div className="story-proof-operation">{currentOperation && <MathFragment latex={currentOperation} />}</div>
        <div className="story-proof-subject" data-story-row-id={row.id}>{currentEquation.lhsLatex && <MathFragment latex={currentEquation.lhsLatex} />}</div>
        <div className="story-proof-relation">
          {currentEquation.relationLatex && <MathFragment latex={currentEquation.relationLatex} />}
          <MathFragment latex={currentEquation.rhsLatex} />
        </div>
      </Fragment>
    })}
  </div>
}

function StorySupport({ support }: { support: CalculationStorySupport }) {
  const heading = supportHeading(support)
  return <details
    className="story-support"
    data-story-support={support.id}
    data-story-support-kind={support.kind}
    open={support.defaultOpen}
  >
    <summary>
      <span className="story-support-kind">{heading.kind}</span>
      <span className="story-support-title">{heading.title}</span>
      <span className="story-support-chevron" aria-hidden="true">⌄</span>
    </summary>
    <div className="story-support-body"><ProofRows support={support} /></div>
  </details>
}

function AlternativeSupport({ alternative }: { alternative: CalculationStoryAlternative }) {
  const support: CalculationStorySupport = {
    id: `alternative-${alternative.parentRowId}`,
    title: `Alternative · ${alternative.title}`,
    kind: 'foundation',
    defaultOpen: false,
    rows: alternative.rows,
  }
  return <StorySupport support={support} />
}

function EquationRow({ row, index, alternatives, mainPathOnly }: {
  row: CalculationStoryRow
  index: number
  alternatives: readonly CalculationStoryAlternative[]
  mainPathOnly: boolean
}) {
  const currentEquation = row.equation ?? fallbackEquation(row)
  const currentOperation = operationLatex(row.operation)
  const attachedAlternatives = alternatives.filter(alternative => alternative.parentRowId === row.id)
  const factClass = row.box === 'core' ? ' story-result-core' : row.box ? ` story-fact-${row.box}` : ''

  if (row.kind === 'milestone') {
    return <div className="story-row story-row-milestone" data-story-row-id={row.id} data-story-role="milestone">
      <div className="story-operation" />
      <div className="story-main-equation story-milestone">✓ {row.label ?? row.equationLatex}</div>
      <aside className="story-side is-empty" />
    </div>
  }

  const hasSideContent = Boolean(row.support || row.note || attachedAlternatives.length)
  return <div
    className={`story-row story-spacing-${row.spacing ?? 'continuation'}`}
    data-story-row={row.kind}
    data-story-row-id={row.id}
    data-story-role={row.rowRole}
  >
    <div className="story-operation">{currentOperation && <MathFragment latex={currentOperation} />}</div>
    <div
      className="story-equation-scroller story-main-equation"
      aria-label={`Gleichungszeile ${index + 1}`}
      tabIndex={0}
    >
      <div className="story-equation-line">
        <div
          className={`story-equation-grid${factClass}${row.kind === 'numeric' ? ' is-numeric' : ''}`}
          data-story-fact={row.box ?? undefined}
          data-long-equation={row.equationLatex.length > 64 ? 'true' : undefined}
        >
          <span className="story-lhs">
            {currentEquation.bridgeLatex && <span className="story-bridge"><MathFragment latex={currentEquation.bridgeLatex} /></span>}
            {currentEquation.lhsLatex && <MathFragment latex={currentEquation.lhsLatex} />}
          </span>
          <span className="story-relation">{currentEquation.relationLatex && <MathFragment latex={currentEquation.relationLatex} />}</span>
          <span className="story-rhs"><MathFragment latex={currentEquation.rhsLatex} /></span>
        </div>
      </div>
    </div>
    <aside className={`story-side${hasSideContent && !mainPathOnly ? '' : ' is-empty'}`}>
      {!mainPathOnly && row.support && <StorySupport support={row.support} />}
      {!mainPathOnly && row.note && <p className="story-note">{row.note}</p>}
      {!mainPathOnly && attachedAlternatives.map(alternative => <AlternativeSupport key={alternative.title} alternative={alternative} />)}
    </aside>
  </div>
}

function StorySection({ section, index, rowOffset, alternatives, mainPathOnly }: {
  section: CalculationStorySection
  index: number
  rowOffset: number
  alternatives: readonly CalculationStoryAlternative[]
  mainPathOnly: boolean
}) {
  return <section className="calculation-story-section" data-story-section={section.id} data-story-tier={section.tier ?? 'main'}>
    <header className="story-section-header" data-story-section-header={section.id}>
      <div className="story-operation" />
      <div className="story-section-main">
        <span>{String(index + 1).padStart(2, '0')}</span>
        <h3>{section.title}</h3>
      </div>
      <div className="story-section-side">{section.sideLatex && <MathFragment latex={section.sideLatex} />}</div>
    </header>
    {section.rows.map((row, rowIndex) => <EquationRow
      key={`${section.id}-${row.id}-${rowIndex}`}
      row={row}
      index={rowOffset + rowIndex}
      alternatives={alternatives}
      mainPathOnly={mainPathOnly}
    />)}
  </section>
}

export function CalculationStoryDisplay({ story }: { story: DisplayStory }) {
  const [mainPathOnly, setMainPathOnly] = useState(false)
  const storyRef = useRef<HTMLElement>(null)

  if (story.mode === 'unavailable') {
    return <section className="calculation-story calculation-story-unavailable" role="alert">
      <p className="eyebrow">Herleitung</p>
      <h2>Herleitung nicht verfügbar</h2>
      <p>{story.reason}</p>
    </section>
  }

  const sections = (story.story.sections ?? [{ id: 'story', title: 'Herleitung', rows: story.story.rows }]).filter(section => section.rows.length > 0)
  const alternatives = story.story.alternatives ?? []
  const sectionOffsets = sections.map((_, sectionIndex) => sections.slice(0, sectionIndex).reduce((count, previous) => count + previous.rows.length, 0))
  const overview = story.story.overview

  const setAllProofs = (open: boolean) => {
    storyRef.current?.querySelectorAll<HTMLDetailsElement>('details.story-support').forEach(details => { details.open = open })
  }

  return <section
    ref={storyRef}
    className="calculation-story"
    aria-labelledby="calculation-story-title"
    data-main-path-only={mainPathOnly}
  >
    <header className="story-reference-header">
      <div className="story-reference-title-row">
        <div>
          <p className="eyebrow">Referenzfall Luft</p>
          <h2 id="calculation-story-title">{story.story.title}</h2>
          <p>{overview?.model ?? 'Ideales Gas · konstante Stoffwerte.'}</p>
        </div>
        <div className="calculation-story-controls">
          <button type="button" onClick={() => setAllProofs(true)}>Herleitungen öffnen</button>
          <button type="button" onClick={() => setAllProofs(false)}>Herleitungen schließen</button>
          <button type="button" aria-pressed={mainPathOnly} onClick={() => setMainPathOnly(value => !value)}>Nur Hauptpfad</button>
        </div>
      </div>
      {overview && <div className="story-givens">
        {overview.givens.map((given, givenIndex) => <div className="story-given" data-story-given key={givenIndex}>
          <span>Gegeben</span>
          <MathFragment latex={given} />
        </div>)}
      </div>}
      <div className="story-fact-legend" data-story-fact-legend>
        <span><i className="is-outline" aria-hidden="true" />symbolisch isoliert</span>
        <span><i className="is-ready" aria-hidden="true" />vollständig bestimmt; wiederverwendbar</span>
      </div>
    </header>

    <div className="calculation-story-table" role="region" aria-label="Herleitung: Gleichungszeilen" tabIndex={0}>
      <div className="story-column-headings" data-story-column-headings>
        <div>Operation</div>
        <div>Hauptrechnung</div>
        <div>Grundlage · Herleitung · Bedingung</div>
      </div>
      <div className="calculation-story-spine">
        {sections.map((section, sectionIndex) => <StorySection
          key={section.id}
          section={section}
          index={sectionIndex}
          rowOffset={sectionOffsets[sectionIndex]}
          alternatives={alternatives}
          mainPathOnly={mainPathOnly}
        />)}
      </div>
    </div>
  </section>
}
