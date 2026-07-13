import { useCalculatorStore } from '../store/calculator-store'

export function CalculatorControls() {
  const { module, loadPreset, clearAll } = useCalculatorStore()

  if (!module) return null

  return (
    <section className="control-bar" aria-label="Schnellstart">
      <div>
        <p className="eyebrow">Schnellstart</p>
        <h2>Mit einer konsistenten Aufgabe beginnen</h2>
        <p className="control-copy">
          Lade den Referenzfall oder trage beliebige bekannte Größen direkt ein.
          Der Solver berechnet alles physikalisch Ableitbare live.
        </p>
      </div>
      <div className="control-actions">
        {module.presets?.map(preset => (
          <button
            className="button button-primary"
            key={preset.id}
            onClick={() => loadPreset(preset.id)}
            title={preset.description}
          >
            <span>{preset.name}</span>
            <small>{preset.description}</small>
          </button>
        ))}
        <button className="button button-secondary" onClick={clearAll}>
          Eingaben zurücksetzen
        </button>
      </div>
    </section>
  )
}
