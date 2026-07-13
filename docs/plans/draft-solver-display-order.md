# Draft: Physikalisch sinnvolle Rechenweg-Anzeige

**Status:** DRAFT — Vorplanung fuer spaetere Implementierung
**Erstellt:** 2026-03-05
**Quelle:** User-Spec + Diesel/Otto-Uebungsaufgaben-Analyse
**Abhaengigkeit:** Abschnitt 3 in `docs/plans/ACTIVE.md`

---

## 1. Motivation

Der Solver (Fixed-Point-Iteration) berechnet korrekt, zeigt aber die Schritte
in Berechnungsreihenfolge — nicht in physikalisch/didaktisch sinnvoller
Reihenfolge. Ein Student wuerde eine Klausuraufgabe anders strukturieren:

**Ist-Zustand:** Solver gibt Steps in Iteration-Order aus (welche Formel zuerst
loesbar war).

**Soll-Zustand:** Anzeige gruppiert in Phasen, geordnet entlang des Zykluswegs,
mit optionalen alternativen Rechenwegen (Forks) an didaktisch sinnvollen Stellen.

**Referenz-Loesung:** Die Diesel-Musterloesung (`Loesungen_KP_Diesel_Otto.pdf`)
zeigt die gewuenschte Struktur:
1. Stoffeigenschaften (Ri aus M, cp aus cv+kappa)
2. Zustand 1 (v1 aus IGG, s1 aus Entropieformel)
3. Zustand 2 (p2 aus Adiabatengl., v2 aus IGG) — s2=s1 weil adiabat
4. Zustand 3 (p3=p2 isobar, T3 aus Q=m*cp*dT, v3 aus IGG, s3 berechnet)
5. Zustand 4 (v4=v1 isochor, T4+p4 aus Adiabatengl.) — s4=s3 weil adiabat
6. Q_ab, W_nutz, eta

---

## 2. Feature-Ueberblick

### 2.1 Phasen-System (universell fuer alle Kreisprozesse)

| Phase | Name                        | Inhalt                                         |
|-------|-----------------------------|-------------------------------------------------|
| 0     | Stoffeigenschaften          | cp, cv, Ri, kappa, M — keine Zustandsindizes   |
| 1     | Zustandsbestimmung          | p, T, v an jedem Zustandspunkt, Zyklusrichtung  |
| 2     | Entropie                    | s an jedem Zustandspunkt                        |
| 3     | Energiebilanzen pro Segment | q, w fuer jeden Prozessschritt                  |
| 4     | Kreisprozess-Kenngroessen   | Q_in, Q_out, W_net, eta                         |
| 5     | Plausibilitaetskontrolle    | Alternative Berechnungen zur Verifikation        |

### 2.2 Dynamische Anzeige (Live)

Die Phasen-Sortierung und Fork-Detection laufen bei JEDER Eingabeaenderung
neu. Da der Solver bereits bei jeder Aenderung neu laeuft, ist das Post-Processing
ein Append an den bestehenden Recalculation-Flow.

**Beispiel-Szenario:**
- User gibt nur p1 + T1 → Anzeige: "Phase 0: (nichts zu berechnen), Phase 1:
  v1 = Ri*T1/p1" — nur ein Step, aber korrekt eingeordnet
- User gibt T2 dazu → Phase 1 waechst um Zustand 2 (p2, v2 via Adiabatengl.)
- User gibt Q_in dazu → Phase 1 waechst um Z3+Z4, Phase 3+4 erscheinen

### 2.3 Alternative Rechenwege (Forks)

An bestimmten Stellen kann eine Variable ueber physikalisch verschiedene
Wege berechnet werden. Diese werden als aufklappbare Aeste dargestellt.

**Typische Fork-Punkte:**
- **T an naechstem Zustand:** Prozessrelation vs. Energiebilanz
- **v an Zustand:** IGG (immer primaer) vs. Prozessrelation (Alternative)
- **Wirkungsgrad:** Energiebilanz (universell, primaer) vs. Temperaturformel
  (zyklusspezifisch, Alternative)
- **Arbeit:** 1. Hauptsatz vs. direkte Integration

**Begrenzung:** Max 2-3 Forks pro Loesung. Priorisierung nach didaktischem
Wert (Phase 1 > Phase 4 > Phase 3).

---

## 3. Architektur-Entwurf

### 3.0 Kern-Entscheidung: Anzeige-Logik lebt im Modul, nicht im Core

**Entscheidung (2026-03-05):** Die gesamte Phasen-Sortierung, Fork-Detection
und Display-Aufbereitung ist **Modul-Code**, nicht Core-Code.

**Begruendung:** Der Ingenieursrechner soll spaeter auch Stroemungslehre,
Mechanik, Maschinenelemente etc. abdecken. Diese Fachgebiete haben voellig
andere didaktisch sinnvolle Reihenfolgen — ein Thermo-Phasensystem waere
dort sinnlos. Der Core-Solver (Fixed-Point-Iteration) ist bereits universell
und soll es bleiben.

**Konsequenzen:**
- `solver.ts` bekommt KEINE thermo-spezifische Logik
- Jedes Modul kann optional eine `transformForDisplay(result: SolverResult): DisplaySolverResult`
  Funktion exportieren
- Thermo-Kreisprozess-Module teilen sich eine gemeinsame Helfer-Lib
  (z.B. `src/modules/_thermo-helpers/`) fuer Phasen-Klassifikation und
  Fork-Detection — das ist Modul-Code, kein Core
- Core stellt nur das `SolverResult` bereit; die UI fragt das Modul ob
  ein `DisplaySolverResult` verfuegbar ist und nutzt es dann
- Andere Fachgebiete koennen spaeter eigene Display-Transformer bauen
  ohne den Core oder bestehende Module zu beruehren

**Solver-Aenderung:** Einzige Core-Aenderung die sinnvoll waere: Values-Snapshot
vor jedem Step (3 Zeilen). Das ist universell nuetzlich (jedes Modul koennte
Forks erkennen) und thermo-unabhaengig. Kann aber auch spaeter ergaenzt werden.

### 3.1 Cycle-Definition (Thermo-Kreisprozess-spezifisch)

Jedes Thermo-Kreisprozess-Modul liefert eine Cycle-Definition die beschreibt
welche Zustandspunkte existieren und welcher Prozesstyp sie verbindet.
Dies lebt im Modul (z.B. `src/modules/carnot/cycle.ts`), nicht im Core:

```typescript
interface CycleDefinition {
  id: string                    // "otto", "diesel", "carnot", "seilinger", "joule"
  statePoints: string[]         // ["Z1", "Z2", "Z3", "Z4"] — in Zyklusreihenfolge
  segments: CycleSegment[]      // Verbindungen zwischen Zustandspunkten
  systemType: 'closed' | 'open' // geschlossenes (Otto,Diesel) vs. offenes (Joule) System
}

interface CycleSegment {
  from: string                  // "Z1"
  to: string                    // "Z2"
  processType: ProcessType      // 'isentropic' | 'isobaric' | 'isochoric' | 'isothermal' | 'polytropic'
  constraints: string[]         // z.B. ["s1 = s2", "q12 = 0"] — automatisch aus processType ableitbar
}
```

**Bekannte Zyklen und ihre Segmente:**

| Zyklus    | 1→2         | 2→3       | 3→4         | 4→1       | 4→5 (opt.) | 5→1 (opt.) |
|-----------|-------------|-----------|-------------|-----------|------------|------------|
| Otto      | isentropic  | isochoric | isentropic  | isochoric | —          | —          |
| Diesel    | isentropic  | isobaric  | isentropic  | isochoric | —          | —          |
| Carnot    | isentropic  | isothermal| isentropic  | isothermal| —          | —          |
| Seilinger | isentropic  | isochoric | isobaric    | isentropic| isochoric  | —          |
| Joule     | isentropic  | isobaric  | isentropic  | isobaric  | —          | —          |

### 3.2 Neue Types

Die Display-Types leben NICHT in `src/core/types.ts` (das bleibt universell),
sondern in der Thermo-Helfer-Lib oder im Modul selbst:

```typescript
/** Extended step metadata for display ordering */
interface DisplayStepMeta {
  phase: 0 | 1 | 2 | 3 | 4 | 5
  statePoint: string | null     // "Z1", "Z2", ... oder null fuer globale Steps
  category: FormulaCategory
  phaseOrder: number            // Sortierung innerhalb der Phase
}

type FormulaCategory =
  | 'material_property'         // cp, cv, Ri, kappa, M
  | 'process_relation'          // Adiabatengl., Isothermen-Bedingung
  | 'equation_of_state'         // IGG: p*v = Rs*T
  | 'energy_balance'            // Q = m*c*dT, 1. Hauptsatz
  | 'entropy'                   // Entropie-Formeln
  | 'efficiency'                // eta-Formeln
  | 'cycle_total'               // Q_in, Q_out, W_net, eta

/** Solution fork: alternative calculation path */
interface SolutionFork {
  atPhase: number
  atStepIndex: number           // nach welchem Step der Fork auftritt
  targetVariable: string
  paths: ForkPath[]
  primaryPathIndex: number      // welcher Pfad primaer angezeigt wird
}

interface ForkPath {
  label: string                 // z.B. "Via Adiabatengleichung"
  description: string           // 1 Satz Erklaerung
  steps: SolutionStep[]
  formulaIds: string[]
  physicalReasoning: string     // WARUM dieser Weg funktioniert
}

/** Enriched solver result for display */
interface DisplaySolverResult extends SolverResult {
  displayPhases: DisplayPhase[]
  forks: SolutionFork[]
}

interface DisplayPhase {
  phase: number
  label: string                 // "Stoffeigenschaften", "Zustandsbestimmung", etc.
  steps: (SolutionStep & DisplayStepMeta)[]
  subgroups?: {                 // Optional: Untergruppen (z.B. pro Zustand in Phase 1)
    label: string               // "Zustand 1", "Zustand 2"
    steps: (SolutionStep & DisplayStepMeta)[]
  }[]
}
```

### 3.3 Aenderungen am Solver

**Entscheidung:** Solver bleibt fachbereichs-agnostisch. Einzige optionale
Aenderung: Values-Snapshot vor jedem Step (3 Zeilen, universell nuetzlich).

```typescript
// In solver.ts, im Loop vor jedem Step:
const snapshot = Object.fromEntries(
  Object.entries(values).map(([k, v]) => [k, { ...v }])
)
snapshots.push(snapshot)
```

Erweiterung von `SolverResult` um `snapshots?: Record<string, VariableState>[]`.
Das ist optional und abwaertskompatibel.

### 3.4 Modul-seitige Transform-Pipeline

Das Modul (nicht der Core) baut die Display-Aufbereitung:

```
// Im Modul (z.B. src/modules/carnot/display-transform.ts):
solve()
  → SolverResult { steps, values, snapshots }
  → classifySteps(steps, carnotCycleDefinition)     // Thermo-Helfer
  → reorderForDisplay(classifiedSteps)               // Thermo-Helfer
  → detectForks(steps, registry, snapshots)          // Thermo-Helfer
  → DisplaySolverResult { displayPhases, forks }

// In der UI:
if (module.transformForDisplay) {
  displayResult = module.transformForDisplay(solverResult)
} else {
  displayResult = solverResult  // Fallback: flat list wie bisher
}
```

### 3.5 Step-Klassifikation (Heuristiken)

```
Variable hat keinen Zustandsindex (cp, cv, Rs, kappa, M)
  → Phase 0, category: material_property

Variable hat Zustandsindex und ist p/T/v (p2, T3, v1)
  → Phase 1, statePoint: Z{index}, phaseOrder: stateIndex*10 + propertyPriority
     propertyPriority: T=0, p=1, v=2

Variable hat Zustandsindex und ist s (s1, s2, s3, s4)
  → Phase 2, statePoint: Z{index}

Variable ist Segment-Energie (q12, w23, q_in, q_out fuer Segmente)
  → Phase 3, phaseOrder: segmentIndex

Variable ist Cycle-Total (Q_in, Q_out, W_net, eta)
  → Phase 4, feste Reihenfolge: Q_in=0, Q_out=1, W_net=2, eta=3
```

### 3.6 Fork-Detection Algorithmus

```
Fuer jeden berechneten Step:
  1. Finde alternative Formeln die dasselbe Target loesen koennten
  2. Filter: Waren alle Inputs der Alternative VOR diesem Step bekannt? (→ Snapshot)
  3. Filter: Gehoert die Alternative zu einer ANDEREN Kategorie? (physikalisch verschieden)
  4. Evaluiere die Alternative — gibt sie dasselbe Ergebnis? (→ valider Fork)
  5. Wenn ja: SolutionFork erstellen

Priorisierung (max 3 Forks):
  - Phase 1 Forks bevorzugen (Zustandsbestimmung)
  - Phase 4 Forks (eta) bevorzugen
  - Forks wo der User in einer Klausur genuinely beide Wege nehmen koennte

NICHT als Fork zaehlen:
  - Algebraische Umstellungen derselben Formel
  - Triviale Identitaeten (p3=p2 weil isobar)
  - Cross-Checks die das Ergebnis selbst verwenden
```

---

## 4. UI-Konzept

### 4.1 Phasen-Darstellung

Die Anzeige zeigt vertikale Sektionen mit Phase-Headers:

```
┌─────────────────────────────────────┐
│  Phase 0: Stoffeigenschaften        │
│  ● cp = κ · cv = 1.287 kJ/(kg·K)   │
│  ● Ri = cp - cv = 0.297 kJ/(kg·K)  │
└───────────────┬─────────────────────┘
                │
┌───────────────┴─────────────────────┐
│  Phase 1: Zustandsbestimmung        │
│                                     │
│  ── Zustand 1 ──                    │
│  ● T1 = 288.15 K (gegeben)         │
│  ● p1 = 90000 Pa (gegeben)         │
│  ● v1 = Ri·T1/p1 = 0.951 m³/kg    │
│                                     │
│  ── Zustand 2 ──                    │
│  ● T2 = 463.15 K (gegeben)         │
│  ● p2 via Adiabatengleichung        │
│  ● v2 = Ri·T2/p2 (IGG)            │
│                                     │
│  ── Zustand 3 ──                    │
│  ● p3 = p2 (isobar)                │
│  ┌─── FORK ─────────────────┐      │
│  │ ▼ Pfad A: T3 via Q=ṁcpΔT │ (primaer, offen)
│  │ ▷ Pfad B: T3 via ...      │ (alternativ, zugeklappt)
│  └───────────────────────────┘      │
│  ● v3 = Ri·T3/p3                   │
│  ...                                │
└───────────────┬─────────────────────┘
```

### 4.2 Fork-Darstellung

Primaerer Pfad: immer offen angezeigt.
Alternativer Pfad: zugeklappt mit Label, aufklappbar per Klick.

```
  ↳ Alternative: T3 auch berechenbar ueber Adiabatengleichung
    T3 = T2·(v2/v3)^(κ-1) = ...
```

### 4.3 Uebergaenge zwischen Phasen

Visueller Separator zwischen Phasen — klar erkennbar aber nicht stoerend.
Spiegelt wider wie ein Student seine Klausurloesung mit Ueberschriften
strukturieren wuerde.

---

## 5. Betroffene Dateien (geschaetzt)

### Core (minimal)
| Datei                  | Aenderung                                      | Aufwand |
|------------------------|-------------------------------------------------|---------|
| `src/core/types.ts`   | Optional: `snapshots` Feld in SolverResult      | S       |
| `src/core/solver.ts`  | Optional: Values-Snapshot im Loop (3 Zeilen)    | S       |

### Thermo-Helfer-Lib (NEU, geteilt zwischen Kreisprozess-Modulen)
| Datei                                          | Aenderung                          | Aufwand |
|------------------------------------------------|------------------------------------|---------|
| `src/modules/_thermo-helpers/types.ts`         | NEU: DisplayStepMeta, CycleDefinition, SolutionFork, DisplayPhase, etc. | S |
| `src/modules/_thermo-helpers/step-classifier.ts` | NEU: classifySteps(), reorderForDisplay() ~80 Zeilen | M |
| `src/modules/_thermo-helpers/fork-detector.ts`   | NEU: detectForks(), prioritizeForks() ~120 Zeilen | M |

### Carnot-Modul (erste Implementierung)
| Datei                                          | Aenderung                          | Aufwand |
|------------------------------------------------|------------------------------------|---------|
| `src/modules/carnot/cycle.ts`                  | NEU: CycleDefinition fuer Carnot   | S       |
| `src/modules/carnot/display-transform.ts`      | NEU: transformForDisplay() ~50 Zeilen | M     |
| `src/modules/carnot/formulas.ts`               | category-Feld pruefen/ergaenzen    | S       |

### UI (erweitert)
| Datei                                          | Aenderung                          | Aufwand |
|------------------------------------------------|------------------------------------|---------|
| `src/components/SolutionSteps.tsx`             | Refactor: Phasen-Anzeige wenn DisplaySolverResult vorhanden | L |
| `src/components/ForkDisplay.tsx`               | NEU: Aufklappbare Fork-Aeste       | M       |

### Tests
| Datei                                          | Aufwand |
|------------------------------------------------|---------|
| `tests/modules/_thermo-helpers/step-classifier.test.ts` | M |
| `tests/modules/_thermo-helpers/fork-detector.test.ts`   | M |

**Geschaetzter Modul-Code:** ~250 Zeilen neue Logik (Helfer-Lib + Carnot-spezifisch)
**Geschaetzter UI-Code:** ~200 Zeilen React-Komponenten
**Geschaetzter Core-Code:** ~5 Zeilen (nur Snapshot)

---

## 6. Abhaengigkeiten und Reihenfolge

**Voraussetzungen BEVOR dieses Feature angegangen wird:**
1. Diagramm-Debugging (ACTIVE.md Abschnitt 1) — sichtbarstes Problem zuerst
2. LaTeX-Fixes (ACTIVE.md Abschnitt 2) — Basis-Darstellung muss stimmen

**Implementierungsreihenfolge innerhalb des Features:**
1. Thermo-Helfer-Lib: Types + CycleDefinition Interface
2. Carnot: CycleDefinition exportieren (`carnot/cycle.ts`)
3. Thermo-Helfer: Step-Classifier (classifySteps, reorderForDisplay)
4. Carnot: transformForDisplay() zusammenbauen
5. UI: Phasen-gruppierte Anzeige wenn DisplaySolverResult vorhanden (sichtbarer Effekt!)
6. Optional Core: Values-Snapshot in solver.ts (3 Zeilen)
7. Thermo-Helfer: Fork-Detection
8. UI: Fork-Darstellung (aufklappbare Aeste)
9. Phase 5: Cross-Check-Logik

---

## 7. Offene Fragen

### 7.1 Solver-Scope (ENTSCHIEDEN)
**Entscheidung:** Solver bleibt fachbereichs-agnostisch. Einzige optionale
Aenderung: Values-Snapshot (3 Zeilen, universell). Alle Anzeige-Logik lebt
im Modul bzw. in der Thermo-Helfer-Lib. Siehe Abschnitt 3.0.

**Begruendung:** Der Rechner soll spaeter auch Stroemungslehre, Mechanik,
Maschinenelemente etc. abdecken. Diese haben voellig andere didaktisch
sinnvolle Reihenfolgen. Core muss dumm bleiben.

### 7.2 Formel-Kategorien in bestehenden Formeln
Die `category`-Felder in `formulas.ts` existieren bereits teilweise
("Zustandsgleichung", "Stoffeigenschaften", "Wirkungsgrad", etc.).
Diese muessen eventuell vereinheitlicht werden mit den neuen
`FormulaCategory`-Werten. Mapping noetig.

### 7.3 Carnot-Spezifika
Carnot hat Isothermen statt Isobaren/Isochoren. Die Waerme wird
ueber q = Rs*T*ln(v2/v1) berechnet, nicht ueber Q = m*c*dT.
Phase 3 (Energiebilanzen) sieht daher anders aus als bei Otto/Diesel.
Das Phase-System muss das abdecken.

### 7.4 Extensive vs. Spezifische Groessen
Manche Aufgaben geben Massenstrom (kg/h) und Leistung (kW),
andere arbeiten spezifisch (kJ/kg). Der Rechner muss Q_dot und q,
W_dot und w sinnvoll nebeneinander zeigen koennen.

### 7.5 Performance
Fork-Detection evaluiert alternative Formeln. Bei ~80+ Formeln im
Carnot-Modul: ist das pro Eingabeaenderung schnell genug?
Vermutung: ja, weil evaluations trivial sind (math.js Einzeiler).
Messen nach Implementierung.

---

## 8. Validierungs-Kriterium

Das Feature ist "fertig" wenn:
1. Die Diesel-Aufgabe aus dem PDF (p1=0.9bar, T1=15°C, T2=190°C,
   Q_zu=16.8kW, m=85kg/h, cv=0.99, kappa=1.3) im Rechner genau
   die Reihenfolge der Musterloesung erzeugt:
   - Phase 0: Ri=297, cp=1.287
   - Phase 1: Z1(v1=0.951) → Z2(p2=7.04, v2=0.195) → Z3(T3=1016,
     v3=0.429) → Z4(T4=800, p4=2.498)
   - Phase 2: s1=s2=0.104, s3=s4=1.115
   - Phase 3: Q_ab = -11.96 kW
   - Phase 4: W_nutz = 4.84 kW, eta = 28.8%
2. Mindestens 1 Fork korrekt erkannt und angezeigt wird
3. Die Anzeige sich dynamisch anpasst wenn Eingaben hinzugefuegt/
   entfernt werden

---

## 9. Referenz-Dokumente

- Diesel/Otto Musterloesung: `~/Downloads/Loesungen_KP_Diesel_Otto.pdf`
- Uebungsaufgaben: `~/Downloads/Uebungsaufgaben 6.pdf`
- User-Spec: Eingebettet in Chat-Konversation vom 2026-03-05
  (vollstaendiger Text der "Solver Philosophy: Physically Meaningful
  Calculation Order" Spec)
- Bestehendes Backlog: `docs/plans/ACTIVE.md` Abschnitt 3
- Carnot-Modul: `src/modules/carnot/README.md`
