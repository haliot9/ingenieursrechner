import type { CalculationStoryState } from '../core/calculation-story'
import { renderLatex } from '../utils/latex'

type DisplayStory = Exclude<CalculationStoryState, { mode: 'not-applicable' }>

export function CalculationStoryDisplay({ story }: { story: DisplayStory }) {
  if (story.mode === 'unavailable') {
    return <section className="calculation-story calculation-story-unavailable" role="alert">
      <p className="eyebrow">Herleitung</p>
      <h2>Herleitung nicht verfügbar</h2>
      <p>{story.reason}</p>
    </section>
  }

  return <section className="calculation-story" aria-labelledby="calculation-story-title">
    <header className="calculation-story-heading">
      <p className="eyebrow">Herleitung</p>
      <h2 id="calculation-story-title">{story.story.title}</h2>
      <p>Die Rechenwerte stammen unverändert aus dem Solver. Gemeinsame Beziehungen werden einmal bewiesen und später sichtbar wiederverwendet.</p>
    </header>
    <div className="calculation-story-spine" role="region" aria-label="Herleitung: Gleichungszeilen" tabIndex={0}>
      {story.story.rows.map((row, index) => <div className="story-row" data-story-row={row.kind} key={row.id}>
        <div className="story-operation">{row.operation ?? '—'}</div>
        <div
          className={`story-equation-scroller${row.state ? ` is-${row.state}` : ''}${row.kind === 'numeric' ? ' is-numeric' : ''}`}
          aria-label={`Gleichungszeile ${index + 1}`}
          tabIndex={0}
        >
          <div
            className="story-equation"
            data-long-equation={row.equationLatex.length > 64 ? 'true' : undefined}
            dangerouslySetInnerHTML={{ __html: renderLatex(row.equationLatex, false) }}
          />
        </div>
        <p className="story-note">{row.note ?? ''}</p>
      </div>)}
    </div>
  </section>
}
