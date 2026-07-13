# Carnot-Modul: Task-Backlog

Dieses Dokument ist das langfristige Gedächtnis des Carnot-Moduls.
Es sammelt alle eruierten Aufgaben — Bugs, Features, Architektur-Entscheidungen —
die noch Planung und/oder Diskussion brauchen, bevor sie umgesetzt werden.

**Wie es funktioniert:**
- Neue Aufgaben hier eintragen, sobald sie erkannt werden (auch mitten in anderen Sessions)
- Jede Aufgabe wird zu einer eigenen `docs/plans/ACTIVE.md`-Session geplant und umgesetzt
- Nach Abschluss: Status auf `erledigt` setzen, Link zum Archiv-Plan angeben

---

## Bugs

### ✓ BUG-4: V und v manchmal nicht berechnet trotz ausreichender Daten
- **Status:** erledigt (2026-03-04)
- **Solver-Ergebnis:** Alle 25 Eingabekombinationen (inkl. 3 Entropie-Sets G1-G3)
  berechnen alle Zustandsgroessen korrekt im Solver-Test.
- **UI-Einheiten-Bug:** Store-Code geprueft — `toSI()` konvertiert korrekt nach SI
  vor Solver-Aufruf (`calculator-store.ts:152-169`). Kein Bug gefunden.
- **Archiv:** `docs/plans/archive/2026-03-04-solver-robustness-plan.md`

---

### BUG-5: Solver kennt keine physikalische Reihenfolge
- **Status:** offen — bekannt, bewusst noch nicht behoben
- **Beobachtung:** Fixed-Point-Solver greift erste lösbare Formel, unabhängig davon
  ob es thermodynamisch sinnvoll ist (z.B. v1 vor T1 berechnen). Rechenschritte in
  der UI folgen keiner physikalisch nachvollziehbaren Logik.
- **Impact:** Korrekte Ergebnisse, aber unverständliche Schritt-Reihenfolge.
- **Mögliche Lösung:** Formeln mit `priority`-Gewicht versehen, Solver nach Priorität
  sortieren. Oder: Schritte nach physikalischer Abhängigkeitskette neu sortieren
  (topologisches Sortieren der Abhängigkeitsgraphen).
- **Voraussetzung vor ACTIVE.md:** Architekturentscheidung: Solver ändern oder
  Post-Processing der Steps? Klären mit Nutzer.

---

## Features

### FEAT-1: Alternative Rechenwege nebeneinander anzeigen
- **Status:** offen — Priorität hoch (Nutzerwunsch)
- **Beschreibung:** Der Solver findet intern oft mehrere Wege zu einer Größe. Die UI
  zeigt heute nur einen linearen Schritt-für-Schritt. Gewünscht: 2–3 alternative
  Lösungspfade nebeneinander, damit der Nutzer sieht wie er über verschiedene
  gegebene Größen zum Ergebnis kommt.
- **Beispiel:** v2 kann berechnet werden über:
  1. `p2·v2 = Rs·T2` (aus Zustandsgleichung)
  2. `q_in = Rs·T3·ln(v3/v2)` (aus Wärmeformel, wenn q_in bekannt)
  3. Adiabat-Beziehung 1→2 (wenn v1 bekannt)
- **Scope:** UI-Feature (neue Komponente für alternative Pfade) + Solver-Erweiterung
  (alle möglichen Lösungspfade ermitteln, nicht nur den ersten).
- **Voraussetzung:** Solver müsste alle Wege verfolgen, nicht nur bis zur ersten
  Lösung. Signifikante Architekturänderung.

---

### FEAT-2: Plausibilitätskontrolle (Konsistenzprüfung)
- **Status:** teilweise erledigt (2026-07-13)
- **Umgesetzt:** Modulweite Prüfung von `T3>T1`, η-Temperatur-Beziehung, Isothermen,
  Isentropen, idealer Gasgleichung und 1. Hauptsatz; Widersprüche erscheinen als
  `contradiction`. Strikte Kraftmaschinen-Vorzeichen und `κ>1` sind Constraints.
- **Offen:** Der generische Solver prüft noch nicht automatisch jede vollständig belegte
  Formel. Die aktuelle Carnot-Prüfung deckt die zentralen Invarianten explizit ab.

---

### FEAT-3: Rechenschritte physikalisch geordnet + erklärend
- **Status:** offen — Priorität mittel (hängt mit BUG-5 zusammen)
- **Beschreibung:** Schritte in der UI sollen einer nachvollziehbaren Reihenfolge folgen:
  erst Zustandseigenschaften, dann Übergänge, dann Energiebilanz. Außerdem: Pro Schritt
  kurze Erklärung warum dieser Schritt an dieser Stelle kommt.
- **Scope:** Primär UI + Solver-Step-Sortierung. Keine Formeländerungen.

---

### FEAT-4: LaTeX-Formatierung in allen Zellen korrekt
- **Status:** offen — Priorität niedrig
- **Beobachtung:** Einige Variablensymbole in der UI-Tabelle werden nicht korrekt als
  LaTeX gerendert (z.B. Subscript fehlt, Sonderzeichen als Klartext). Betrifft vor
  allem Anzeige-Labels, nicht die Rechenschritt-Formeln.
- **Scope:** UI-only, keine Solver-/Formeländerung. Symbol-Felder in `config.ts` prüfen.

---

## Architektur

### ARCH-1: Solver-Iterationstiefe und Performance
- **Status:** beobachten
- **Beschreibung:** Aktuell `maxIterations=50`. Bei komplexen Modulen mit langen
  Ableitungsketten könnte das zu wenig sein. Bisher kein Problem beim Carnot-Modul.
- **Messbar:** Schritt-Counter in Solver-Output auswerten. Wenn je >40 Iterationen
  gebraucht → erhöhen oder Algorithmus optimieren.

---

### ✓ ARCH-2: Negative Constraint-Violations
- **Status:** erledigt (2026-07-13)
- Berechnete Ergebnisse werden im Solver gegen Variablen-Constraints validiert.
- Strikte Grenzen (`greaterThan`, `lessThan`) decken `κ>1` sowie Wärme-/Arbeitsvorzeichen
  der Carnot-Kraftmaschine ab.
- Modulweite Cross-Validation prüft zusätzlich Beziehungen zwischen mehreren Werten.

---

## Erledigte Aufgaben

### ✓ DIAG-1: Diagram-Debugging v2 (EnergyArrows, DirectionMarkers, Kurven)
- EnergyArrow-Positionierung: von Plot-Zentrum auf Segment-Mittelpunkte umgestellt
  (CAD-Zwangsbedingung: Waerme-Pfeile an Isothermen, Arbeit im Zyklusbild)
- Labels mit Werten (q_zu = X kJ/kg) direkt am Pfeil
- DirectionMarker: Tangente aus benachbarten Curve-Samples statt Chord-Richtung
- Endpoint-Blending: C linear geblendet fuer exakte Endpunkte
- curveMidpoint_pv/ts Helper in curve-math.ts
- 5-Layer-Architektur: RefLines → Curves → DirMarkers → EnergyArrows → StatePoints
- Fix: 2026-03-06 — PVDiagram.tsx, TSDiagram.tsx, EnergyArrow.tsx, curve-math.ts

### ✓ FEAT-5: Entropie-Variablen s1-s4
- Variablen s1-s4 in `config.ts`, 8 Formeln in `formulas.ts`
  (isentrope Constraints, absolute Entropie, Entropie-Differenz aus Waerme)
- Golden-State und Input-Sets erweitert, 3 neue Entropie-Input-Sets (G1-G3)
- 69/69 Tests gruen, alle bestehenden Sets berechnen jetzt auch s1-s4
- Fix: 2026-03-04

### ✓ BUG-1: Solver gab falsche Zustandswerte (v1 zeigte v4)
- Ursache: Fehlende Isotherme Constraints (T2=T3, T4=T1) + falsche Prozesszuordnung
- Fix: 2026-03-01, Session 2 — `formulas.ts` komplett neu strukturiert
- Archiv: `docs/plans/archive/2026-03-01-carnot-solver-correctness-plan.md`

### ✓ BUG-2: q_out falsches Vorzeichen
- Ursache: `q_out = Rs*T1*ln(v4/v1)` lieferte positiven Wert; thermodynamisch korrekt
  ist negativ (Wärme verlässt System)
- Fix: 2026-03-02 — auf `ln(v1/v4)` geändert; first_law und eta_from_energy angepasst

### ✓ BUG-3: Adiabate Formeln nie angewendet
- Ursache: `applicableProcesses: ['adiabatic']` + Store hatte `activeProcesses = {}`
- Fix: 2026-03-01 — `applicableProcesses` aus allen Carnot-Formeln entfernt

### ✓ BUG-6: cv und cp nie berechenbar wenn nur Rs und κ gegeben
- Ursache: Mayer (`cp=cv+Rs`) und kappa_def (`κ=cp/cv`) bilden ein 2-Gleichungen-
  2-Unbekannte-System. Der Fixed-Point-Solver kann nur 1-Unbekannte-Formeln lösen.
- Fix: 2026-03-04 — Abgeleitete Formel `cv = Rs/(κ-1)` in `formulas.ts` ergänzt.
  Bricht den Deadlock: cv wird direkt berechnet, dann cp über Mayer oder kappa_def.
- Archiv: `docs/plans/archive/2026-03-04-solver-robustness-plan.md`
