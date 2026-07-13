/** A physical variable in the calculator (e.g., pressure, temperature) */
export interface Variable {
  id: string                    // unique key, e.g. "p1", "T2", "eta"
  symbol: string                // display symbol, e.g. "p₁", "T₂", "η"
  latex: string                 // LaTeX symbol, e.g. "p_1", "T_2", "\\eta"
  name: string                  // human name, e.g. "Druck am Zustand 1"
  defaultUnit: string           // SI unit string, e.g. "Pa", "K", "J/kg"
  alternativeUnits: string[]    // other units user can choose, e.g. ["bar", "kPa"]
  constraints?: VariableConstraint[]
  group?: string                // grouping for UI, e.g. "Zustand 1", "Global"
}

export interface VariableConstraint {
  type: 'min' | 'max' | 'positive' | 'nonzero' | 'greaterThan' | 'lessThan'
  value?: number
  message: string              // e.g. "Temperatur muss > 0 K sein"
}

/** A formula that relates variables */
export interface Formula {
  id: string                    // unique key
  name: string                  // e.g. "Ideale Gasgleichung"
  latex: string                 // e.g. "p \\cdot V = m \\cdot R_s \\cdot T"
  /**
   * Pre-solved forms: key = variable to solve for, value = math.js expression string.
   * Example: { "p1": "m * Rs * T1 / V1", "V1": "m * Rs * T1 / p1", ... }
   */
  solveFor: Record<string, string>
  /**
   * LaTeX templates for each solve direction.
   * Key = variable to solve for, value = { rearranged: LaTeX, explanation: string }
   */
  latexSteps: Record<string, { rearranged: string; explanation: string }>
  /** Which variable IDs are involved */
  variables: string[]
  /** Optional: only applies when certain process type is active */
  applicableProcesses?: string[]
  /** Category for grouping */
  category?: string
}

/** A single computation step recorded by the solver */
export interface SolutionStep {
  formulaId: string
  formulaName: string
  targetVariable: string         // which variable was solved
  targetSymbol: string           // LaTeX symbol of the target
  originalLatex: string          // original formula in LaTeX
  rearrangedLatex: string        // formula rearranged for target variable
  substitutedLatex: string       // with values plugged in
  resultLatex: string            // final result with unit
  resultValue: number            // numeric result
  resultUnit: string             // unit of the result
  explanation: string            // human-readable explanation
}

/** The state of a single variable in the calculator */
export interface VariableState {
  value: number | null
  unit: string                  // currently selected unit
  isUserInput: boolean          // true if user entered this value
  isComputed: boolean           // true if solver computed this
  stepIndex?: number            // which step computed this (for highlighting)
}

/** Process types for thermodynamic calculators */
export interface ProcessType {
  id: string                    // e.g. "adiabatic", "isothermal"
  name: string                  // e.g. "Adiabat (isentrop)"
  description: string
  constraints: string[]         // e.g. ["q = 0", "s = const"]
}

/** A named, deterministic input set that helps users start with a valid example. */
export interface CalculatorPreset {
  id: string
  name: string
  description: string
  values: Record<string, number>
}

/** A calculator module definition */
export interface CalculatorModule {
  id: string
  name: string                  // e.g. "Carnot-Prozess"
  description: string
  icon?: string
  variables: Variable[]
  formulas: Formula[]
  processes?: ProcessType[]
  presets?: CalculatorPreset[]
  groups: string[]              // ordered list of variable groups for UI
  /** Optional module-specific title for the generic result summary. */
  summaryTitle?: string
  /** Optional declarative process strip rendered by the generic result summary. */
  processSequence?: Array<{ transition: string; label: string }>
  /** Optional: validates module-level relationships across multiple values. */
  validateValues?: (values: Record<string, VariableState>) => SolverError[]
  /** Optional: liefert Diagramm-Daten fuer p-v und T-s Darstellung */
  getDiagramSpec?: (values: Record<string, VariableState>) => DiagramSpec | null
}

/** Result of a solver run */
export interface SolverResult {
  values: Record<string, VariableState>
  steps: SolutionStep[]
  unsolved: string[]            // variable IDs that couldn't be computed
  errors: SolverError[]
}

export interface SolverError {
  type: 'insufficient_data' | 'contradiction' | 'constraint_violation' | 'computation_error'
  message: string
  variableId?: string
  formulaId?: string
}

// ─── Diagram Engine Types ────────────────────────────────────────────────────

export type CurveType =
  | 'adiabatic'   // p·v^kappa = const  (p-v: steile Hyperbel)
  | 'isothermal'  // p·v = const        (p-v: flache Hyperbel)
  | 'isobaric'    // p = const          (p-v: Horizontale)
  | 'isochoric'   // v = const          (p-v: Vertikale)
  | 'polytropic'  // p·v^n = const      (p-v: zwischen adiabat und isotherm)

export interface DiagramStatePoint {
  id: string           // "1", "2", "2a" — frei waehlbar
  label: string        // Anzeige-Label, z.B. "Z₁"
  p: number | null     // Druck [Pa]
  v: number | null     // Spez. Volumen [m³/kg]
  T: number | null     // Temperatur [K]
  s: number | null     // Spez. Entropie [J/(kg·K)]
}

export interface DiagramSegment {
  from: string         // DiagramStatePoint.id
  to: string           // DiagramStatePoint.id
  processType: CurveType
  n?: number           // Polytropenexponent (nur bei 'polytropic')
  label?: string       // z.B. "1→2 isentrop"
}

export interface DiagramEnergyFlow {
  type: 'heat' | 'work'
  value: number        // > 0 = rein (Zufuhr), < 0 = raus (Abfuhr)
  label: string        // LaTeX-Label z.B. "q_{zu}"
  location: string     // Segment-Ref "1-2" oder "global"
}

export interface DiagramGasContext {
  kappa: number | null
  Rs: number | null
  cp: number | null
  cv: number | null
}

export interface DiagramSpec {
  statePoints: DiagramStatePoint[]
  segments: DiagramSegment[]
  energyFlows: DiagramEnergyFlow[]
  gasContext: DiagramGasContext
  processDirection: 'clockwise' | 'counterclockwise' | null
}
