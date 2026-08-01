import { renderLatex } from '../../utils/latex'
import { getJouleProofExcerpt } from '../model/joule-proof'
import './JouleProof.css'

export interface JouleProofProps {
  onOpenCalculator?: () => void
}

export function JouleProof({ onOpenCalculator }: JouleProofProps = {}) {
  const rows = getJouleProofExcerpt()

  return <section id="rechenweg" className="joule-proof" aria-labelledby="joule-proof-title">
    <header className="joule-proof__header">
      <p className="landing-eyebrow">Authentischer Rechenweg</p>
      <h2 id="joule-proof-title">Vom Modell zur Wärmezufuhr.</h2>
      <p>
        Stationärer Betrieb, ein Ein- und Austritt sowie vernachlässigbare Änderungen der kinetischen
        und potenziellen Energie reduzieren die allgemeine Kontrollvolumenbilanz. Erst mit fehlender
        technischer Arbeit im Heizer und konstanten Stoffwerten des idealen Gases wird die abschließende
        Wärmezufuhrbeziehung gültig.
      </p>
      {onOpenCalculator && <button
        className="joule-proof__calculator"
        type="button"
        onClick={() => onOpenCalculator()}
      >
        Joule-Rechner öffnen
      </button>}
    </header>

    <ol className="joule-proof__equations" aria-label="Auszug aus dem Joule-Rechenweg">
      {rows.map((row, index) => {
        const isResult = index === rows.length - 1
        return <li
          key={row.id}
          className={`joule-proof__equation${isResult ? ' joule-proof__equation--result' : ''}`}
          data-proof-row-id={row.id}
          aria-label={isResult ? 'Berechnetes Ergebnis' : undefined}
          tabIndex={0}
          dangerouslySetInnerHTML={{ __html: renderLatex(row.equationLatex, true) }}
        />
      })}
    </ol>
  </section>
}
