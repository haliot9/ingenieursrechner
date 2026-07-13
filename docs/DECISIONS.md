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
