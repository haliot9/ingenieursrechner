import { useState } from 'react'
import type { Variable, VariableState } from '../core/types'
import { useCalculatorStore } from '../store/calculator-store'
import { ValueInput } from './ValueInput'
import { UnitSelector } from './UnitSelector'

export function CalculatorTable() {
  const { module, values } = useCalculatorStore()
  if (!module) return null

  return (
    <div className="variable-groups">
      {module.groups.map(group => {
        const variables = module.variables.filter(variable => variable.group === group)
        if (variables.length === 0) return null
        return <VariableGroup group={group} key={group} variables={variables} values={values} />
      })}
    </div>
  )
}

function VariableGroup({
  group,
  variables,
  values,
}: {
  group: string
  variables: Variable[]
  values: Record<string, VariableState>
}) {
  const [isOpen, setIsOpen] = useState(group === 'Zustand 1' || group === 'Stoffeigenschaften')
  const filled = variables.filter(variable => values[variable.id]?.value !== null).length

  return (
    <details
      className="variable-group"
      open={isOpen}
      onToggle={event => setIsOpen(event.currentTarget.open)}
    >
      <summary>
        <span>{group}</span>
        <small>{filled}/{variables.length} Werte</small>
      </summary>
      <div className="table-wrap">
        <table className="variable-table">
          <thead>
            <tr>
              <th>Variable</th>
              <th>Wert</th>
              <th>Einheit</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {variables.map(variable => {
              const state = values[variable.id]
              return (
                <tr key={variable.id}>
                  <td className="variable-cell">
                    <span className="variable-symbol">{variable.symbol}</span>
                    <span>{variable.name.replace(/ \(Zustand \d\)$/, '')}</span>
                  </td>
                  <td className="value-cell">
                    <ValueInput
                      key={`${variable.id}-${state?.unit ?? ''}`}
                      variableId={variable.id}
                    />
                  </td>
                  <td className="unit-cell">
                    <UnitSelector
                      variableId={variable.id}
                      defaultUnit={variable.defaultUnit}
                      alternatives={variable.alternativeUnits}
                    />
                  </td>
                  <td className="status-cell"><StatusBadge state={state} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </details>
  )
}

function StatusBadge({ state }: { state?: VariableState }) {
  if (!state || state.value === null) return <span className="status-badge status-empty">Offen</span>
  if (state.isUserInput) return <span className="status-badge status-input">Eingabe</span>
  if (state.isComputed) return <span className="status-badge status-computed">Berechnet</span>
  return null
}
