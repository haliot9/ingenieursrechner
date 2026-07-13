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
  SolverResult {values, steps, errors}
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

**Aktuell:** Carnot-Prozess und idealer Luftstandard-Diesel-Prozess (Thermodynamik)
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
- `StepDisplay` - expandable KaTeX derivation steps
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
