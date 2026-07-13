import { useCalculatorStore } from '../store/calculator-store'
import { getAllModules } from '../modules'

export function ModuleSelector() {
  const { activeModuleId, setModule } = useCalculatorStore()
  const modules = getAllModules()

  return (
    <nav className="module-nav" aria-label="Rechnermodule">
      {modules.map(mod => (
        <button
          key={mod.id}
          onClick={() => setModule(mod.id)}
          className="module-button"
          style={{
            backgroundColor: mod.id === activeModuleId ? 'var(--accent)' : 'var(--bg-secondary)',
            color: mod.id === activeModuleId ? 'var(--bg-primary)' : 'var(--text-secondary)',
          }}
        >
          {mod.name}
        </button>
      ))}
    </nav>
  )
}
