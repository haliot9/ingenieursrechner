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
  CalculatorModule ---> FormulaRegistry ---> solver dispatch
                                              /          \
                               legacy fixed-point      SolveDirection[]
                                              \          |
                                               \  derivation planner
                                                \         |
                                                 \  selected execution
                                                  \       /
  SolverResult {values, steps[provenance], errors, plan?}
        |
        +--> optional PresentationPlan --> StepDisplay
        |
        +--> optional module calculation-story adapter --> CalculationStoryDisplay
        |
        v
  UI-Rendering (React Components + KaTeX)
```

## Landing and calculator boundary

The public root presents the landing experience. `?view=calculator` is the stable direct entry to the existing calculator, with an optional `module` query parameter selecting an existing registered module. Landing-only theme, navigation-rail, exploration, and motion state never enters the calculator store.

```text
URL boundary
├── Landing presentation state → registry/reference adapters → existing SVG/story evidence
└── Calculator page → Zustand store → deterministic solver
```

Landing content derives available calculators from the existing module registry and reads reference evidence through public module, diagram, and calculation-story interfaces. It does not duplicate solver authority or introduce a second calculation path.

The URL boundary lazy-loads the landing and calculator pages independently. Solver-backed landing chapters are loaded only as their stable chapter placeholders approach the viewport; accessible loading and reload states preserve navigation targets without placing solver or calculator code in the initial entry.

See [the landing subsystem guide](../src/landing/README.md) for its chapter/responsibility map, protected visible contracts, and configuration pipelines.

## Schichten

### 1. Core Engine (`src/core/`)
Komplett UI-unabhaengig, isoliert testbar.

| Datei | Verantwortung |
|-------|---------------|
| `types.ts` | Single Source of Truth fuer alle Interfaces |
| `solver.ts` | Fuehrt entweder den Legacy-Fixed-Point-Loop oder eine vorab gewaehlte endliche Route aus und protokolliert Solver-Evidenz |
| `formula-registry.ts` | Index ueber Formeln, Filterung nach Prozesstyp |
| `solve-directions.ts` | Kompiliert voraufgeloeste Ziele zu endlichen `formulaId:targetId`-Richtungen |
| `derivation-planner.ts` | Ermittelt Erreichbarkeit, Primaerrouten, begrenzte Alternativen und blockierte Ziele |
| `derivation-builder.ts` | Baut strukturierte, provenance-gebundene Einzelschritte ohne Solver-Mutation |
| `calculation-story.ts` | Definiert die optionale, modul-eigene Proof-/Story-Grenze |
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
**Perspektive:** Weitere Fachgebiete erscheinen erst, wenn Modell, Solverpfad und Erklaerung belastbar implementiert sind.

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
6. Modul ohne `plannedExecution`: Legacy-Fixed-Point-Loop sucht Formeln mit genau 1 Unbekannten
7. Modul mit `plannedExecution`:
   a. Kompiliere jede freigegebene `solveFor`-Richtung zu `formulaId:targetId`
   b. Plane aus bekannten Fakten eine deterministische, azyklische Primaerroute
   c. Fuehre nur die gewaehlten Richtungen aus
   d. Validiere jeden abgeleiteten Wert und unveraenderliche redundante User-Fakten
   e. Speichere `SolutionStep` inklusive Quellen- und Schritt-Provenance
8. Bei vorhandenem Plan: Erzeuge optionalen PresentationPlan und eine optionale modul-eigene Calculation Story; Legacy-Schritte bleiben direkt darstellbar
9. SolverResult -> Store -> React Re-Render -> KaTeX Rendering
```

## Wichtige Invarianten
- **Determinismus:** Gleicher Input = Gleicher Output, keine Zufallskomponenten
- **SI intern:** Alle Berechnungen in SI-Einheiten, Konvertierung nur am Ein-/Ausgang
- **Pre-solved numerische Formeln:** Der Solver stellt nicht symbolisch um; alle `solveFor`-Richtungen sind vordefiniert
- **Endliche Richtungsautoritaet:** Eine numerische oder sichtbare Route braucht eine explizite Modulfreigabe; der Rechner katalogisiert keine kompletten Eingabeszenarien
- **Immutable User-Fakten:** Eingaben werden niemals durch abgeleitete Werte ueberschrieben; vollstaendige Redundanzpruefung ist Teil des Phase-A-Vertrags
- **Phase-A-Proof-Provenance:** Ein generalisierter sichtbarer Herleitungsschritt muss auf akzeptierte Solver-Evidenz zurueckfuehren
- **Phase-A-Rest-Evidenz:** Beim Ausbau darf eine partielle oder nicht verfuegbare Story unerklaerte Schritte, Blockaden, Alternativen oder Widersprueche nicht unterdruecken
- **Kein Backend:** Alles laeuft client-side im Browser

## Derivation authority

The full identity hierarchy, finite relation/direction/proof grammar, input-state contract, bounded algebra rules, coverage gates, and future topology/property seams are defined in [DERIVATION_ARCHITECTURE.md](DERIVATION_ARCHITECTURE.md). That document distinguishes current implementation from the Phase A contract and deferred future work.

## Calculation-story seam

`CalculationStory` is an optional module-owned presentation seam, not a second solver. For a planned run it receives the selected `ReachabilityPlan`, accepted final solver values, `SolutionStep` provenance, and module variable metadata after numerical solving. The adapter returns `complete`, explicit `unavailable`, or `not-applicable`; store-level exception handling never alters accepted numeric state.

The Joule adapter exposes one full Story only for the exact approved six-input reference-air preset. Changed or additional user inputs return `not-applicable`, preserving the generic solver presentation. The numerical planner actively uses 44 derive directions and four validate-only checks. A separate reconciled 12-family story inventory mirrors those identities for future proof expansion, but the current reference composer does not consume it. Rows carry semantic chain state, typed equations, and explicit KaTeX operations so rendering does not infer algebraic continuity from raw strings. The current complete/unavailable Story surface suppresses generic evidence; truthful coexistence of unconsumed steps, alternatives, blocked facts, and contradictions is explicitly Phase A work. See [CALCULATION_STORY_PILOT.md](CALCULATION_STORY_PILOT.md), whose name is retained for link continuity although it now documents the full story.

## Static Joule / Brayton module

`src/modules/joule` owns the ideal four-state Joule/Brayton configuration, formula registry, cross-variable validation, and diagram adapter. It registers through the shared module, solver, store, and renderer seams. The calculator page still contains one stale route-string guard for the superseded `joule-learning-story-v0.2`; it does not match the current `joule-human-reference-v1` route and is a later cleanup item rather than architecture authority.

## Semantic-family authority

The numerical Joule planner reconciles 48 registered directions into 44 derive directions and four validate-only `Rs` checks. The separate 12-family story inventory maps those identities for future proof expansion. Another scenario requires explicit recipe/provenance enforcement, negative tests, and product approval before Full Story may activate.

The reference journey groups rows into seven visible sections: material properties; state 1; compression; heat input; expansion; energy path; and cycle balance/performance. Numeric continuation rows deliberately omit their left subject.
