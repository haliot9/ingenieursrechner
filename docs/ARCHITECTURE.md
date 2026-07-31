# Architektur: Ingenieursrechner

## Zweck
Modularer, browserbasierter Ingenieursrechner der aus gegebenen Werten automatisch alle fehlenden Groessen berechnet und jeden Rechenschritt in LaTeX darstellt.

## High-Level Diagramm
```
User-Input (Werte + Einheiten)
        |
        v
  Zustand Store (zustand)
        |
        v
  Input-Validation (validator.ts)
        |
        v
  Solver (solver.ts) <--- FormulaRegistry <--- CalculatorModule
        |                                           |
        v                                     config.ts + formulas.ts
  ReachabilityPlan + SolverResult {values, steps, errors, provenance}
        |
        +--> PresentationPlan --> legacy StepDisplay
        |
        +--> optional module calculation-story adapter --> CalculationStoryDisplay
        |
        v
  UI-Rendering (React Components + KaTeX)
```

## Schichten

### 1. Core Engine (`src/core/`)
Komplett UI-unabhaengig, isoliert testbar.

| Datei | Verantwortung |
|-------|---------------|
| `types.ts` | Single Source of Truth fuer alle Interfaces |
| `solver.ts` | Fixed-Point-Iteration: findet Formeln mit 1 Unbekannten, loest auf, wiederholt |
| `formula-registry.ts` | Index ueber Formeln, Filterung nach Prozesstyp |
| `step-tracker.ts` | LaTeX-formatierte Rechenschritte |
| `unit-converter.ts` | SI-Konvertierung via math.js |
| `validator.ts` | Input-Constraints (positiv, Bereich, nonzero) |

### 2. Module (`src/modules/`)
Jedes Modul definiert ein abgeschlossenes Rechengebiet.

**Struktur pro Modul:**
- `config.ts` - Variablen (mit Einheiten, Constraints, Gruppen), Prozesstypen
- `formulas.ts` - Formeln mit `solveFor` (pre-solved Expressions) + `latexSteps`
- `index.ts` - Export als `CalculatorModule`

**Aktuell:** Carnot-Prozess sowie ideale Luftstandard-Diesel-, Otto- und statische ideale Joule-/Brayton-Prozesse (Thermodynamik)
**Geplant:** Weitere Module (Kinematik, Stroemungsmechanik, etc.)

### 3. State Management (`src/store/`)
Zustand-Store der alles verbindet:
- Aktives Modul + Registry
- Alle Variablen-Zustaende (Wert, Einheit, User-Input vs. Computed)
- Aktive Prozesse (z.B. "isothermal" zwischen Zustand 1-2)
- Auto-Recalculation bei jedem Input-Change

### 4. UI Components (`src/components/`)
React function components with Tailwind CSS v4 plus an original light industrial design system.
- `CalculatorControls` - deterministic module presets and reset action
- `CalculatorTable` - collapsible input groups; desktop table and mobile card layout
- `ResultSummary` - cycle status, energy balance, efficiency, and process sequence
- `DiagramPanel` - module-independent p-v and T-s visualizations
- `StepDisplay` - expandable KaTeX derivation steps for legacy/non-opted-in paths
- `CalculationStoryDisplay` - continuous semantic proof spine for a module-owned opted-in story
- `ValueInput` / `UnitSelector` - unit-aware inputs with mobile-size controls
- `ModuleSelector` - accessible live-filtered module picker driven by the module registry

## Datenfluss (Detail)
```
1. User tippt Wert ein
2. setValue() im Store -> speichert als VariableState {value, unit, isUserInput: true}
3. recalculate() wird automatisch getriggert
4. Validator prueft Constraints
5. Solver bekommt nur User-Input-Werte + FormulaRegistry
6. Solver-Loop:
   a. Finde Formel mit genau 1 Unbekannten
   b. math.js evaluate() mit Scope der bekannten Werte
   c. Speichere SolutionStep (LaTeX: Original -> Umgestellt -> Eingesetzt -> Ergebnis)
   d. Markiere Variable als computed
   e. Wiederhole bis nichts mehr loesbar
7. SolverResult -> Store -> React Re-Render -> KaTeX Rendering
```

## Wichtige Invarianten
- **Determinismus:** Gleicher Input = Gleicher Output, keine Zufallskomponenten
- **SI intern:** Alle Berechnungen in SI-Einheiten, Konvertierung nur am Ein-/Ausgang
- **Pre-solved Formeln:** Keine symbolische Umstellung zur Laufzeit, alle solveFor-Richtungen vordefiniert
- **Kein Backend:** Alles laeuft client-side im Browser

## Calculation-story seam

`CalculationStory` is an optional module-owned presentation seam, not a second solver. It receives the selected `ReachabilityPlan`, immutable final solver values, `SolutionStep` provenance, and module variable metadata after numerical solving. The adapter returns `complete`, explicit `unavailable`, or `not-applicable`; store-level exception handling never alters accepted numeric state.

The Joule adapter exposes one full Story only for the exact approved six-input reference-air preset. Changed or additional user inputs return `not-applicable`, preserving the generic solver presentation. The 44-direction registry is a reconciled future-expansion inventory, not active generalized runtime authority. Rows carry semantic chain state (chain ID, row role, structured bridge/left/relation/right equation, and KaTeX operation) so rendering never infers algebraic continuity from raw strings. Checks and alternatives remain separate presentation states. See [CALCULATION_STORY_PILOT.md](CALCULATION_STORY_PILOT.md), whose name is retained for link continuity although it now documents the full story.

## Static Joule / Brayton module

src/modules/joule owns the ideal four-state Joule/Brayton configuration, formula registry, cross-variable validation, and diagram adapter. It registers through the existing module registry and generic result/store/renderer seams; no solver, store, renderer, or UI special case is introduced.

## Semantic-family authority

The 12-family registry reconciles 48 registered directions into 44 derive directions and four validate-only `Rs` checks for future route expansion. Another scenario requires explicit recipe/provenance enforcement, negative tests, and product approval before Full Story may activate.

The reference journey groups rows into seven visible sections: material properties; state 1; compression; heat input; expansion; energy path; and cycle balance/performance. Numeric continuation rows deliberately omit their left subject.
