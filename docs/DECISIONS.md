# Architektur-Entscheidungen

Jede Entscheidung mit Kontext, Alternativen und Begruendung.

---

## D1: Pre-solved Formeln statt symbolischer Umstellung
**Entschieden:** Formeln werden in `solveFor` fuer jede Variable vorab aufgeloest hinterlegt.
**Alternative:** math.js/SymPy zur Laufzeit symbolisch umstellen lassen.
**Begruendung:**
- Deterministisch und debugbar (kein CAS-Blackbox-Verhalten)
- Schneller (kein Parsing/Solving zur Laufzeit)
- LaTeX-Steps koennen manuell optimiert werden statt auto-generiert
**Trade-off:** Jede neue Variable muss manuell in solveFor ergaenzt werden.

## D2: Kein Backend — reiner Browser-Client
**Entschieden:** Komplette Berechnung client-side mit math.js.
**Alternative:** Server-side CAS (SymPy, Maxima).
**Begruendung:**
- Keine Infrastruktur noetig, kein Hosting fuer Backend
- math.js reicht fuer algebraische Auswertung von pre-solved Expressions
- Sofortige Reaktion ohne Netzwerk-Latenz
**Trade-off:** Kein symbolisches CAS moeglich (z.B. Integration, Differentiation).

## D3: Fixed-Point-Iteration als Solver
**Entschieden:** Iterativer Algorithmus der Formeln mit 1 Unbekannten sucht und loest.
**Alternative:** Gleichungssystem-Solver (z.B. Newton-Raphson fuer nichtlineare Systeme).
**Begruendung:**
- Einfach zu verstehen und zu debuggen
- Liefert natuerliche Reihenfolge der Rechenschritte (didaktisch wertvoll)
- Ausreichend fuer die meisten Ingenieurs-Berechnungen wo Variablen kettenartig zusammenhaengen
**Trade-off:** Kann zirkulaere Abhaengigkeiten nicht loesen (z.B. implizite Gleichungen).

**Current refinement:** Modules may opt into `plannedExecution`. The planner compiles the same pre-solved directions, selects one deterministic acyclic primary route, and then executes only that route. Carnot, Diesel, and Otto still use the legacy loop; Joule currently opts into planned execution.

## D4: Zustand fuer State Management
**Entschieden:** Zustand (leichtgewichtiger React-Store).
**Alternative:** Redux, React Context, Jotai.
**Begruendung:**
- Minimaler Boilerplate, TypeScript-first
- Kein Provider-Wrapping noetig
- Einfache Integration mit React 18/19
- Ein Store reicht fuer die gesamte App

## D5: Tailwind CSS v4 with CSS variables and an industrial responsive UI
**Decided:** Plugin-based Tailwind v4 plus CSS custom properties in `index.css`.
**Alternative:** CSS Modules, styled-components, or a third-party component framework.
**Rationale:**
- Tailwind v4 is CSS-native and requires no `tailwind.config.js`
- CSS variables keep diagram and component colors consistent
- The original light/dark industrial system prioritizes numeric scanning over decoration
- Responsive table-to-card behavior keeps the same component model usable on phones
**Trade-off:** The design system is project-owned and must be maintained deliberately.

## D6: KaTeX statt MathJax
**Entschieden:** KaTeX fuer LaTeX-Rendering.
**Alternative:** MathJax.
**Begruendung:**
- Deutlich schneller (relevant bei Live-Recalculation)
- Kleinere Bundle-Size
- Sync-Rendering (kein async noetig)

## D7: Modulares System mit Template
**Entschieden:** Jedes Fachgebiet als eigenstaendiges Modul in src/modules/.
**Alternative:** Monolithische Formel-Sammlung.
**Begruendung:**
- Module sind unabhaengig voneinander entwickelbar
- Template (_template/) macht neue Module schnell erstellbar
- Jedes Modul kapselt seine Variablen, Formeln und Prozesstypen

---

## D8: Custom SVG statt Charting-Library fuer Diagramme
**Entschieden:** p-v und T-s Diagramme als handgeschriebenes SVG (React-Komponenten).
**Alternative:** Chart.js, D3, Recharts, Plotly.
**Begruendung:**
- Thermodynamische Kurven (Adiabaten, Isothermen) brauchen exakte physikalische Formeln
  — keine Charting-Lib kann `p·v^κ=const` nativ
- Volle Kontrolle ueber Layer-Reihenfolge, Hover-Tooltips, Energiepfeile
- Kein Dependency-Overhead fuer ~300 Zeilen SVG-Code
- Log-log Skalierung fuer p-v manuell implementiert (Charting-Libs machen das anders)

---

## D10: Declarative module result summaries and process strips
**Decided:** Module-specific result titles and process strips are declared on `CalculatorModule`, while `ResultSummary` remains generic.
**Alternative:** Branch in the UI on each module ID.
**Rationale:**
- A new calculator module must not require a special-case React branch.
- Each thermodynamic module owns its visible process topology.
- The shared summary keeps its metrics, accessibility structure, and responsive behavior.
**Trade-off:** Modules must keep their process metadata consistent with formulas and diagrams.

---

## D9: Modul-Adapter-Funktion fuer Diagramm-Daten
**Entschieden:** Jedes Modul liefert optional `getDiagramSpec()` → generisches `DiagramSpec`.
**Alternative:** Diagramm-Komponenten lesen direkt aus dem Store/Solver.
**Begruendung:**
- Diagramm-Komponenten sind modulunabhaengig (PVDiagram kennt kein "Carnot")
- DiagramSpec ist ein Zwischenformat: Zustandspunkte + Segmente + Energiefluesse
- Neue Module (Otto, Diesel) implementieren nur ihren Adapter, Rendering bleibt gleich
- Curve-Math-Utils (`sampleCurve_pv/ts`) arbeiten nur mit dem generischen Format

---

## D11: Query-based application boundary and native motion
**Decided:** The public root renders the landing page. The calculator uses a stable `?view=calculator` query entry, with an optional registered `module` parameter. Navigation uses the browser History API and `popstate`. Landing motion uses native browser APIs, CSS transitions and transforms, and the existing custom SVG approach by default. One deferred, component-scoped GSAP `3.13.0` exception is allowed for the exact ReactBits-derived Thermodynamics menu; it does not establish a shared landing animation framework.
**Alternatives:** Path-based client routing with a router dependency, or an animation framework shared across the landing experience.
**Rationale:**
- Query navigation works on GitHub Pages without server-side rewrite rules and preserves the relative Vite asset strategy.
- Browser history still provides direct links and Back navigation for the bounded landing/calculator split.
- Native scrolling, media, observer, and CSS primitives cover the current video, rail, settling, and SVG reveal requirements without adding runtime dependency weight.
- The deferred Thermodynamics exception preserves the pinned ReactBits item motor while keeping GSAP outside the initial landing chunk and every unrelated landing effect.
- Landing presentation state remains outside the Zustand calculator store and cannot change accepted numeric state.
**Trade-off:** The boundary is intentionally limited rather than a general routing system. Native motion lifecycles still require explicit cleanup, reduced-motion handling, and browser fallbacks; the narrow GSAP exception additionally requires pinned provenance, component-scoped cleanup, and deferred-bundle containment.

## D12: Finite relation and direction authority instead of scenario enumeration

**Decided:** A module declares finite quantities, physical relations, target-specific `formulaId:targetId` directions, conditions, and route policy. The planner generates a route from the actual user facts.

**Rejected alternatives:**

- one hard-coded record for every complete input combination;
- an unrestricted runtime CAS that invents solve routes.

**Rationale:** Local directions are reviewable, deterministic, independently testable, and reusable across many numeric values and input subsets. Scenario enumeration grows combinatorially, while an unrestricted CAS cannot own physical meaning or teaching priority.

**Trade-off:** Every supported numerical direction and declared composite route remains explicit module authority.

**Implementation status:** Current for Joule numerical planned execution. Policy and proof-authority migration for Otto, Diesel, and Carnot remains Phase A work.

## D13: Numerical provenance and learner proof are separate authorities

**Decided:** Numerical execution preserves user facts and records exact direction provenance. A module-owned proof composer may explain only selected solver evidence for which approved proof authority exists. Rendering never infers algebra from strings.

**Rejected alternatives:** Treating the solver's final number as sufficient proof, or letting a hand-authored story operate independently of selected provenance.

**Rationale:** A correct result can still have a false rearrangement, condition, arrow, source relation, or teaching order. Separating authorities keeps failures local and lets generic evidence remain available when a polished story is partial or unavailable.

**Trade-off:** Direction, recipe, provenance, and residual-evidence coverage require explicit reconciliation tests.

**Implementation status:** The solver currently records numerical provenance, and the reference Joule composer mirrors selected direction identities and accepted values. Recipe-to-`SolutionStep` reconciliation, generalized composition, and residual generic-evidence coexistence remain Phase A work.

## D14: Static modules now, topology compiler later

**Decided:** Generalise the four current fixed-topology ideal-cycle modules before building configurable cycle topology. Shared core contracts remain insensitive to state count and opaque quantity IDs. A later module-local component compiler may emit the same quantities, relation applications, policies, validation, diagrams, and proof applications.

**Rejected alternatives:** Baking every future variant into the current four-state modules, or building a universal component/equation-system editor before the basic learner proof works.

**Rationale:** This preserves a future extension seam without delaying or destabilising the minimum-complexity educational cycles.

**Trade-off:** Coupled implicit blocks, property providers, phase models, and repeated-component identities remain later explicit features.

**Implementation status:** This is a compatibility constraint, not an implemented topology compiler or property layer.

See [DERIVATION_ARCHITECTURE.md](DERIVATION_ARCHITECTURE.md) for the complete contract.
