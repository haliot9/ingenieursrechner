import { useCalculatorStore } from '../store/calculator-store'

function formatValue(value: number | null | undefined, unit: string, digits = 4): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const formatted = new Intl.NumberFormat('de-DE', {
    maximumSignificantDigits: digits,
  }).format(value)
  return unit ? `${formatted} ${unit}` : formatted
}

export function ResultSummary() {
  const { module, values } = useCalculatorStore()
  if (!module) return null

  const inputs = Object.values(values).filter(value => value.isUserInput).length
  const computed = Object.values(values).filter(value => value.isComputed).length
  const eta = values.eta?.value
  const solved = eta !== null && eta !== undefined

  const metrics = [
    {
      label: 'Wirkungsgrad',
      value: solved ? `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(eta * 100)} %` : '—',
      tone: 'accent',
    },
    { label: 'Wärmezufuhr', value: formatValue(values.q_in?.value, values.q_in?.unit), tone: 'thermal' },
    { label: 'Wärmeabfuhr', value: formatValue(values.q_out?.value, values.q_out?.unit), tone: 'muted' },
    { label: 'Nettoarbeit', value: formatValue(values.w_netto?.value, values.w_netto?.unit), tone: 'muted' },
  ]

  return (
    <section className="result-summary" aria-labelledby="result-title">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">Live-Auswertung</p>
          <h2 id="result-title">{module.summaryTitle ?? 'Zyklusbilanz'}</h2>
        </div>
        <span className={`solver-state ${solved ? 'is-ready' : ''}`}>
          {solved ? 'Zyklus gelöst' : `${inputs} Eingaben · ${computed} berechnet`}
        </span>
      </div>

      <div className="metric-grid">
        {metrics.map(metric => (
          <div className={`metric metric-${metric.tone}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>

      <div className="cycle-strip" aria-label="Prozessfolge des Kreisprozesses">
        {(module.processSequence ?? []).flatMap((step, index) => [
          <span key={step.transition}><b>{step.transition}</b><small>{step.label}</small></span>,
          ...(index === (module.processSequence?.length ?? 0) - 1 ? [] : [<i aria-hidden="true" key={`${step.transition}-separator`} />]),
        ])}
      </div>
    </section>
  )
}
