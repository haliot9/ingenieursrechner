import type { Formula, CalculatorModule } from './types'

/**
 * FormulaRegistry manages the formulas available to the solver.
 * Each calculator module registers its formulas here.
 */
export class FormulaRegistry {
  private formulas: Map<string, Formula> = new Map()
  private byVariable: Map<string, Set<string>> = new Map() // variable -> formula IDs

  register(formula: Formula): void {
    this.formulas.set(formula.id, formula)
    for (const varId of formula.variables) {
      if (!this.byVariable.has(varId)) {
        this.byVariable.set(varId, new Set())
      }
      this.byVariable.get(varId)!.add(formula.id)
    }
  }

  registerAll(formulas: Formula[]): void {
    for (const f of formulas) this.register(f)
  }

  get(id: string): Formula | undefined {
    return this.formulas.get(id)
  }

  getAll(): Formula[] {
    return Array.from(this.formulas.values())
  }

  /** Get all formulas that involve a given variable */
  getForVariable(variableId: string): Formula[] {
    const ids = this.byVariable.get(variableId)
    if (!ids) return []
    return Array.from(ids).map(id => this.formulas.get(id)!).filter(Boolean)
  }

  /** Get formulas that can solve for a specific variable */
  getFormulasToSolve(targetVariable: string): Formula[] {
    return this.getForVariable(targetVariable).filter(f => targetVariable in f.solveFor)
  }

  /** Filter formulas by applicable process types */
  filterByProcess(formulas: Formula[], activeProcesses: string[]): Formula[] {
    return formulas.filter(f => {
      if (!f.applicableProcesses || f.applicableProcesses.length === 0) return true
      return f.applicableProcesses.some(p => activeProcesses.includes(p))
    })
  }

  clear(): void {
    this.formulas.clear()
    this.byVariable.clear()
  }

  static fromModule(mod: CalculatorModule): FormulaRegistry {
    const registry = new FormulaRegistry()
    registry.registerAll(mod.formulas)
    return registry
  }
}
