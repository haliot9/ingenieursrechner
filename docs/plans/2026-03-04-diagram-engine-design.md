# Diagramm-Engine Design

**Status:** Approved (2026-03-04)
**Scope:** Moduluebergreifende p-v und T-s Diagramme fuer beliebige thermodynamische Kreisprozesse

---

## Zusammenfassung

Eine universelle Diagram-Engine die p-v und T-s Diagramme rendert. Jedes Modul liefert
seine Daten ueber eine Adapter-Funktion (`getDiagramSpec`). Die Engine ist komplett
modul-agnostisch — sie kennt nur das `DiagramSpec`-Interface, nie das Modul direkt.

---

## Architektur-Entscheidung

**Option A gewaehlt: Modul exportiert Adapter-Funktion.**

Jedes Modul hat eine `diagram.ts` die eine Funktion exportiert:
```
src/modules/carnot/diagram.ts  → getCarnotDiagramSpec(values) → DiagramSpec
src/modules/joule/diagram.ts   → getJouleDiagramSpec(values, config) → DiagramSpec
```

Begruendung: Joule mit variablen Intercoolern/Reheatern hat dynamische Topologie
(N Zustandspunkte, nicht zur Compile-Zeit bekannt). Nur eine Funktion kann das
flexibel abbilden. Statische Config-Deklaration reicht nicht.

---

## DiagramSpec Interface (Vertrag Modul → Engine)

```typescript
interface DiagramSpec {
  statePoints: StatePoint[]
  segments: Segment[]
  energyFlows: EnergyFlow[]
  gasContext: GasContext
  processDirection: 'clockwise' | 'counterclockwise' | null
}

interface StatePoint {
  id: string           // "1", "2", "2a", "3" — frei waehlbar
  label: string        // Anzeige-Label, z.B. "Z₁"
  p: number | null     // Druck [Pa]
  v: number | null     // Spez. Volumen [m³/kg]
  T: number | null     // Temperatur [K]
  s: number | null     // Spez. Entropie [J/(kg·K)]
}

interface Segment {
  from: string              // StatePoint-ID
  to: string                // StatePoint-ID
  processType: CurveType
  n?: number                // Polytropenexponent (nur bei 'polytropic')
  label?: string
}

type CurveType =
  | 'adiabatic'      // p·v^kappa = const  →  steile Hyperbel im p-v
  | 'isothermal'     // p·v = const        →  flache Hyperbel im p-v
  | 'isobaric'       // p = const          →  Horizontale im p-v
  | 'isochoric'      // v = const          →  Vertikale im p-v
  | 'polytropic'     // p·v^n = const      →  zwischen adiabat und isotherm

interface EnergyFlow {
  type: 'heat' | 'work'
  value: number            // > 0 = rein (Zufuhr), < 0 = raus (Abfuhr)
  label: string            // LaTeX-Label: "q_{zu}", "w_{netto}"
  location: string         // Segment-Ref "1-2" oder "global"
}

interface GasContext {
  kappa: number | null     // Fuer Isentropen-Referenzlinien
  Rs: number | null        // Fuer Isothermen
  cp: number | null        // Fuer Isobaren im T-s
  cv: number | null        // Fuer Isochoren im T-s
}
```

---

## Zurueckgestellt: Polytrope Overlay (fuer Joule)

Bei mehrstufiger Verdichtung mit Intercoolern entsteht ein Zick-Zack zwischen Adiabate
und Isotherme. Eine "mittlere Wirklinie" (polytrope Regressionskurve) zeigt wo der
Prozess im Mittel verlaeuft. Geplantes Interface:

```typescript
interface DiagramOverlay {
  type: 'polytropic_envelope'
  throughPoints: string[]         // StatePoint-IDs fuer Regressionskurve
  style: 'dashed' | 'dotted'
  label?: string                  // "Mittlere Polytrope"
}

// Spaeter in DiagramSpec: overlays?: DiagramOverlay[]
```

Wird erst bei Joule-Implementierung ins DiagramSpec aufgenommen. Architektur ist
darauf vorbereitet (Segments + StatePoints sind bereits dynamisch/variabel).

---

## UI Layout

Bestehendes 2-Spalten-Layout bleibt. Diagramme kommen in die rechte Spalte:

```
[Wertetabelle (50%)]  |  [p-v Diagramm        ]
                      |  [T-s Diagramm        ]
                      |  [Fehleranzeige       ]
                      |  [Rechenschritte      ]
```

- Beide Diagramme untereinander, volle Breite der rechten Spalte
- Kompakte Hoehe (~250-300px pro Diagramm) damit Steps nicht zu weit runter rutschen
- Responsive: auf Mobile alles untereinander, volle Breite
- Diagramme erscheinen nur wenn genuegend Daten berechnet sind
  (mindestens 2 StatePoints mit gueltigen Koordinaten fuer das jeweilige Diagramm)
- Wenn keine Diagramm-Daten: kein leerer Platzhalter, einfach nicht rendern

---

## Interaktivitaet

- **Hover auf StatePoint:** Tooltip zeigt alle Werte (p, v, T, s) mit Einheiten
- **Hover auf Segment-Kurve:** Prozesstyp-Label und zugehoerige Energiefluesse
- **Hover auf EnergyArrow:** Wert mit Vorzeichen und Einheit
- **CSS Transitions:** Sanftes Morphen wenn sich berechnete Werte aendern
  (Punkte gleiten, Kurven morphen, Pfeile drehen sich)

---

## Rendering-Ansatz

### Custom SVG in React — keine externe Charting-Library

Begruendung:
- Mathematisch definierte Kurven (Potenzfunktionen), keine empirischen Datenserien
- Volle Kontrolle ueber Pfeile, Annotations, gestrichelte Referenzlinien
- Keine zusaetzliche Dependency (aktuell nur 5 Prod-Dependencies)
- SVG animiert nativ mit CSS Transitions
- viewBox macht es automatisch responsive

### Kurvenberechnung (p-v Diagramm)

Pro Segment 50-100 Zwischenpunkte parametrisch ueber den v-Bereich gesamplet:

| Kurventyp   | Formel                           | Konstante                  |
|-------------|----------------------------------|----------------------------|
| Adiabat     | p = C / v^kappa                  | C = p_from · v_from^kappa  |
| Isotherm    | p = Rs·T / v                     | T = T_from = T_to          |
| Isobar      | p = const, v linear interpoliert | p = p_from = p_to          |
| Isochor     | v = const, p linear interpoliert | v = v_from = v_to          |
| Polytrop    | p = C / v^n                      | C = p_from · v_from^n      |

### Kurvenberechnung (T-s Diagramm)

| Kurventyp   | Formel                                       |
|-------------|----------------------------------------------|
| Isentrop    | Vertikale Linie (s = const)                  |
| Isotherm    | Horizontale Linie (T = const)                |
| Isobar      | T = T_ref · exp((s - s_ref) / cp)           |
| Isochor     | T = T_ref · exp((s - s_ref) / cv)           |
| Polytrop    | Zwischen Isentrop und Isotherm, via n        |

### Referenzlinien (Hintergrund)

Durch jeden Zustandspunkt optional feine gestrichelte Linien:
- **p-v:** Isotherme und Isentrope durch den Punkt
- **T-s:** Isobare und Isochore durch den Punkt
- Farbe: sehr dezent (10-15% Opacity), Stil: gestrichelt
- Zeigt dem Nutzer wie die theoretischen Verlaeufe an jedem Punkt aussehen

### Energiefluss-Pfeile

- **Farbe:** Waerme = rot/orange, Arbeit = blau
- **Richtung:** value > 0 → Pfeil zum Prozess (rein), value < 0 → Pfeil weg (raus)
- **Position:** segment-spezifisch (Pfeil an der Kurve) oder global (Pfeil am Zentrum)
- **Animation:** Sanfte Drehung (CSS Transition) wenn Vorzeichen wechselt

### Umlaufrichtung

Kleine Pfeil-Marker entlang der Prozesskurven. Richtung bestimmt durch `processDirection`:
- `clockwise` → Kraftmaschine (w_netto < 0, Arbeit wird abgegeben)
- `counterclockwise` → Waerme-/Kaeltemaschine (w_netto > 0, Arbeit wird investiert)

---

## Dateistruktur

```
src/components/diagrams/
  README.md                 ← Erklaert Konzept, Interface, wie man fuer ein neues
                              Modul einen Adapter schreibt, bekannte Einschraenkungen
  DiagramPanel.tsx          ← Container: holt DiagramSpec aus Store, rendert beide
  PVDiagram.tsx             ← p-v Diagramm (SVG)
  TSDiagram.tsx             ← T-s Diagramm (SVG)
  shared/
    Axes.tsx                ← SVG-Achsen mit Labels und Auto-Ticks
    ProcessCurve.tsx        ← Ein Kurvensegment (SVG path aus Zwischenpunkten)
    StatePointMarker.tsx    ← Beschrifteter Punkt mit Hover-Tooltip
    ReferenceLine.tsx       ← Gestrichelte Hintergrundlinie
    EnergyArrow.tsx         ← Waerme-/Arbeitspfeil (SVG, richtungsabhaengig)
    DirectionMarker.tsx     ← Umlaufrichtungs-Pfeil auf Kurve
    Tooltip.tsx             ← Hover-Tooltip Komponente

src/utils/
  curve-math.ts             ← Parametrische Kurvenberechnung fuer alle CurveTypes
  diagram-scales.ts         ← Auto-Zoom, Achsen-Ranges, Tick-Berechnung

src/core/types.ts           ← DiagramSpec + alle Sub-Interfaces hinzufuegen
                              (dort wo alle Types leben — Single Source of Truth)

src/modules/carnot/
  diagram.ts                ← getCarnotDiagramSpec(values) → DiagramSpec
```

---

## Carnot-Adapter (Beispiel-Logik)

```
getCarnotDiagramSpec(values):
  1. Liest p1-p4, v1-v4, T1-T4, s1-s4, kappa, Rs, cp, cv aus values
  2. Baut 4 StatePoints: Z1(p1,v1,T1,s1) bis Z4(p4,v4,T4,s4)
  3. Baut 4 Segments:
     - 1→2: adiabatic  (isentrope Kompression)
     - 2→3: isothermal (Waermezufuhr)
     - 3→4: adiabatic  (isentrope Expansion)
     - 4→1: isothermal (Waermeabfuhr)
  4. Baut EnergyFlows:
     - q_in  an Segment "2-3" (Wert aus values.q_in)
     - q_out an Segment "4-1" (Wert aus values.q_out)
     - w_netto als "global"
  5. processDirection:
     - w_netto < 0 → 'clockwise'     (Kraftmaschine)
     - w_netto > 0 → 'counterclockwise' (Waerme-/Kaeltemaschine)
     - w_netto null → null
  6. GasContext: { kappa, Rs, cp, cv }
```

---

## Docs-Anforderung

**`src/components/diagrams/README.md` muss enthalten:**
1. Was ist die Diagram-Engine (Zweck, Scope)
2. Das DiagramSpec-Interface erklaert (was jedes Feld bedeutet)
3. Wie man einen Adapter fuer ein neues Modul schreibt (Schritt-fuer-Schritt)
4. Welche CurveTypes unterstuetzt werden und ihre Formeln
5. Bekannte Einschraenkungen (z.B. Polytrope Overlay noch nicht implementiert)
6. Wo lebt was (Dateistruktur-Referenz)

**Kein separates TASKS.md** fuer die Diagram-Komponente — sie ist kein eigenstaendiges
Rechenmodul. Bekannte Einschraenkungen und Zukunfts-Features gehoeren in die README
und werden bei Bedarf in das jeweilige Modul-TASKS.md referenziert.
