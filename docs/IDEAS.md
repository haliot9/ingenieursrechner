# Ideen & Zukünftige Features

Gesammelte Ideen die noch nicht geplant oder beauftragt sind.
Kein Implementierungsplan — nur Ideensammlung damit nichts verloren geht.

---

## Gasdatenbank (projektweite Ressource)

**Idee:** JSON-Datei `src/data/gases.json` mit gängigen Arbeitsgasen.
Jedes Gas enthält: Name, Formel, M, Rs, cp, cv, κ, Gültigkeitsbereich.

**Beispielgase:** Luft, N₂, O₂, CO₂, H₂, H₂O, Ar, CH₄, NH₃

**UI:** Autocomplete-Suchfeld (Eingabe "Sti" → schlägt "Stickstoff / N₂" vor).
Auswahl setzt Rs, M, cp, cv, κ automatisch — mit Möglichkeit manuell zu überschreiben.

**Wichtig:** Option "manuelle Eingabe" bleibt immer erhalten (für Uni-Aufgaben mit gegebenen Werten).

**Scope:** Nicht Carnot-spezifisch, für alle Thermomodule nutzbar.
Pointer in ACTIVE.md wenn Gasdatenbank als Feature geplant wird.

---

## Spezifisch vs. Total (q/w vs. Q/W)

**Idee:** Umschalter zwischen spezifischen Größen (J/kg) und totalen Größen (J).
Betrifft Wärme (q ↔ Q) und Arbeit (w ↔ W).

**Problem:** Alle Variablen auf eine Seite zu quetschen wird unübersichtlich.
Möglichkeit: Tab-Ansicht oder Toggle pro Gruppe.

**Offene Fragen:**
- Wie verhält sich der Solver? Braucht er beide Varianten oder reicht eine?
- Wie werden Formeln angezeigt wenn der User zwischen den Ansichten wechselt?
- Gilt das für alle Module oder nur Thermo?

**Scope:** Grundsatzentscheidung für UI-Architektur — eigene Brainstorming-Session nötig.

---

## Massenstrom / Volumenstrom

**Idee:** ṁ [kg/s] und V̇ [m³/s] als Variablentypen.
Relevant für offene Systeme (Joule-Gasturbine, Strömungsmechanik).

**Scope:** Joule-Modul — nicht für Carnot (geschlossener Kreisprozess).
Wenn Joule-Modul geplant wird, dort einplanen.

---

## Symbolischer Formelparser für Molare Masse

**Idee:** User tippt "CO2" → Rechner berechnet M = 1×12.011 + 2×15.999 = 44.009 g/mol.
Braucht Periodensystem-Lookup + Parser für chemische Formeln.

**Scope:** Komplex, kaum Mehrwert wenn Gasdatenbank existiert.
Niedrige Priorität.

---

## Alternative Rechenwege nebeneinander anzeigen

**Idee:** Wenn ein Wert über mehrere Formel-Routen berechenbar ist, alle Routen
nebeneinander anzeigen — nicht nur den ersten gefundenen Weg.

**Beispiel:** η kann berechnet werden über:
- Route A: η = 1 - T_kalt/T_warm (Carnot-Formel)
- Route B: η = w_netto / q_in (Energiebilanz)

Beide Routen gleichzeitig zeigen, mit Hinweis ob die Ergebnisse konsistent sind.

**Didaktischer Wert:** Sehr hoch für Lernende — sehen dass mehrere Wege zum Ziel führen.
**Technische Komplexität:** Hoch — Solver müsste alle Pfade verfolgen, nicht nur den ersten.

**Scope:** Langfristiges Feature. Erst wenn Solver-Korrektheit (BUG-1 bis BUG-3) gelöst.

---

## Property-Based Testing mit fast-check

**Idee:** `fast-check` als zusätzliche Test-Schicht neben Unit-Tests.
Statt fester Beispielwerte generiert fast-check automatisch zufällige Eingaben
und prüft Eigenschaften (Invarianten) die immer gelten müssen.

**Was testen:**
- Solver: Abstürzfreiheit für beliebige numerische Eingaben (no crash guarantee)
- Validator: Kein throw für beliebige Strings (keine unbehandelten Exceptions)
- Physikalische Invarianten: Wenn κ berechnet wird → κ > 1 für ideale Gase
- Rundungsrobustheit: Sehr kleine / sehr große Werte crashen nicht

**Beispiel:**
```typescript
fc.assert(fc.property(
  fc.float({ min: 1e-6, max: 1e6 }), // T1
  fc.float({ min: 1e-6, max: 1e6 }), // T2
  (T1, T2) => {
    const result = solve(registry, variables, { T1, T2 })
    expect(result).toBeDefined() // kein Crash
    if (result.values.eta?.isComputed) {
      expect(result.values.eta.value).toBeGreaterThanOrEqual(0)
      expect(result.values.eta.value).toBeLessThanOrEqual(1)
    }
  }
))
```

**Wo einbauen:** `tests/core/solver-property.test.ts`, `tests/core/validator-property.test.ts`

**Scope:** Implementierungs-Prompt in `docs/prompts/implement-fast-check.md`.
Erst sinnvoll nachdem BUG-1 bis BUG-3 behoben (falsche Ergebnisse zuerst korrigieren,
dann auf Robustheit testen).

---

## Option C: JSON → TypeScript Modulcodegen

**Idee:** Module als JSON-Schema definieren, Build-Step generiert TypeScript.
Besonders interessant für LLM-gestützte Modulerzeugung.

**Scope:** Relevant ab 10+ Modulen oder wenn LLM-Workflow intensiver genutzt wird.
Jetzt (Entscheidung D7) als TypeScript-Template gelöst — JSON optional später.

---

## Entropien für charakteristische Punkte

**Idee:** s₁, s₂, s₃, s₄ als berechnete Größen im Carnot-Modul (und allen
zukünftigen Kreisprozess-Modulen). Entropie ist zentral für T-s-Diagramme
und für das physikalische Verständnis der Zustandsänderungen.

**Formeln:**
- Isentrop: s₁ = s₂, s₃ = s₄ (beim Carnot)
- Allgemein: Δs = cᵥ·ln(T₂/T₁) + Rₛ·ln(v₂/v₁) oder Δs = cₚ·ln(T₂/T₁) − Rₛ·ln(p₂/p₁)
- Absolut: Referenzentropie + Δs akkumuliert über Prozessschritte

**Offene Fragen:**
- Referenzpunkt für absolute Entropie? (s₁ = 0 als Konvention oder berechnet?)
- Wie Entropie in Variablen-Config einbauen? Neue Variable-Kategorie oder wie p, T, v?

**Scope:** Voraussetzung für T-s-Diagramme. Sollte vor Diagramm-Feature kommen.

---

## p-V und T-s Diagramme (Echtzeit-Plotting)

**Idee:** Interaktive Diagramme die sich in Echtzeit aktualisieren wenn der User
Werte eingibt. Zeigt den Kreisprozess als geschlossene Kurve mit den
charakteristischen Punkten 1–4 (und mehr bei komplexeren Zyklen).

**Anforderungen:**
- p-V-Diagramm: Druck vs. spezifisches Volumen, logarithmische Achsen sinnvoll
- T-s-Diagramm: Temperatur vs. spezifische Entropie
- Charakteristische Linien einblendbar: Isochore, Isobare, Isotherme, Isentrope
- Punkte 1–4 beschriftet, Prozesslinien farbcodiert nach Zustandsänderung
- Echtzeit: Diagramm baut sich auf während Werte berechnet werden

**Technisch:**
- Charting-Lib: Recharts, D3, oder Plotly? (Recharts passt gut zu React)
- Kurvenberechnung: Zwischenpunkte interpolieren (z.B. Adiabate: p·v^κ = const,
  Isotherme: p·v = const → parametrisch über v-Bereich samplen)
- Achsenskalierung: Auto-Zoom auf berechneten Bereich

**Besonders wertvoll bei Joule/Ericsson/Brayton:** Zeigt wie polytrop
angenäherte Prozesse mit Intercoolern und Reheatern im Zick-Zack
die adiabaten Linien zur Isothermen drücken. Visuell extrem lehrreich.

**Scope:** Mittelfristiges Feature. Braucht: Entropie-Berechnung, ausreichend
viele berechnete Zustandspunkte, Charting-Library-Entscheidung.

---

## Schaltplan-Visualisierung (utopisch / langfristig)

**Idee:** Visueller Schaltplan des thermodynamischen Systems, der sich dynamisch
ändert je nachdem welche Module/Komponenten aktiv sind. Turbine, Verdichter,
Wärmetauscher, Intercooler, Reheater, Regenerator — als Blöcke mit
Verbindungspfeilen und Zustandswerten an den Stellen.

**Warum utopisch:** Sehr visuelles Feature, komplexes Layout-Problem.
Jede Kombination von Modulen ergibt ein anderes Schaltbild. Automatisches
Layout von Blockschaltbildern ist ein eigenständiges Engineering-Problem.

**Mögliche Vereinfachung:** Vorgefertigte SVG-Templates pro Zyklustyp
(Carnot, Joule, Ericsson) statt vollautomatisches Layout. Werte werden
nur an feste Positionen eingetragen.

**Scope:** Fernziel. Erst sinnvoll wenn mehrere Module existieren und die
Diagramm-Infrastruktur (p-V, T-s) steht.
