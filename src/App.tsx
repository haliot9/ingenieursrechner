import { useCalculatorStore } from './store/calculator-store'
import { ModuleSelector } from './components/ModuleSelector'
import { CalculatorTable } from './components/CalculatorTable'
import { CalculatorControls } from './components/CalculatorControls'
import { ResultSummary } from './components/ResultSummary'
import { StepDisplay } from './components/StepDisplay'
import { ErrorDisplay } from './components/ErrorDisplay'
import { DiagramPanel } from './components/diagrams/DiagramPanel'

function App() {
  const { module, steps, errors, values } = useCalculatorStore()
  const cycleSolved = values.eta?.value !== null && values.eta?.value !== undefined
  const visibleErrors = cycleSolved
    ? errors.filter(error => error.type !== 'insufficient_data')
    : errors

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="page-width header-inner">
          <a className="brand" href="#top" aria-label="Ingenieursrechner Startseite">
            <span className="brand-mark" aria-hidden="true">IR</span>
            <span>
              <strong>Ingenieursrechner</strong>
              <small>Deterministische Rechenwege</small>
            </span>
          </a>
          <ModuleSelector />
        </div>
      </header>

      <main id="top" className="page-width main-content">
        {module && (
          <>
            <section className="hero" aria-labelledby="module-title">
              <div>
                <p className="eyebrow">Thermodynamik · Kreisprozesse</p>
                <h1 id="module-title">{module.name}</h1>
                <p className="hero-copy">{module.description}</p>
              </div>
              <div className="hero-facts" aria-label="Modellannahmen">
                <span>Ideales Gas</span>
                <span>κ konstant</span>
                <span>SI intern</span>
                <span>Rechenweg sichtbar</span>
              </div>
            </section>

            <CalculatorControls />

            <div className="workspace-grid">
              <section className="input-panel" aria-labelledby="input-title">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Eingaben & Zustände</p>
                    <h2 id="input-title">Bekannte Größen</h2>
                  </div>
                  <p>Nur vorhandene Werte eintragen. Alle übrigen Felder werden automatisch berechnet.</p>
                </div>
                <CalculatorTable />
              </section>

              <aside className="analysis-panel" aria-label="Ergebnisse und Diagramme">
                <ResultSummary />
                <ErrorDisplay errors={visibleErrors} />
                <DiagramPanel />
                <StepDisplay steps={steps} />
              </aside>
            </div>
          </>
        )}
      </main>

      <footer className="site-footer">
        <div className="page-width footer-inner">
          <p><strong>Ingenieursrechner</strong> · Carnot-Modul</p>
          <p>Idealisiertes Lehrmodell. Ergebnisse immer mit Aufgabenstellung und Stoffmodell abgleichen.</p>
        </div>
      </footer>
    </div>
  )
}

export default App
