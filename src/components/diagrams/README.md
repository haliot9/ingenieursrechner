# Diagram Engine

Moduluebergreifende SVG-Diagramme fuer p-v und T-s Kreisprozesse.
Rendert thermodynamische Zustandsdiagramme in Echtzeit basierend auf berechneten Werten.

## Konzept

Die Engine ist komplett modul-agnostisch. Jedes Rechenmodul (Carnot, Joule, etc.)
liefert seine Daten ueber eine Adapter-Funktion (`getDiagramSpec`), die ein
`DiagramSpec`-Objekt zurueckgibt. Die Engine kennt nur dieses Interface, nie das Modul direkt.

## DiagramSpec Interface

Das zentrale Interface lebt in `src/core/types.ts` (Single Source of Truth):

```typescript
interface DiagramSpec {
  statePoints: DiagramStatePoint[]     // Zustandspunkte (p, v, T, s)
  segments: DiagramSegment[]           // Verbindungen zwischen Punkten
  energyFlows: DiagramEnergyFlow[]     // Waerme- und Arbeitsfluesse
  gasContext: DiagramGasContext        // Stoffeigenschaften (kappa, Rs, cp, cv)
  processDirection: 'clockwise' | 'counterclockwise' | null
}
```

### Felder im Detail

- **statePoints**: Thermodynamische Zustaende mit id, label und Werten (p, v, T, s).
  Werte koennen `null` sein wenn noch nicht berechnet.
- **segments**: Verbindungen zwischen Zustandspunkten. `processType` bestimmt die Kurvenform.
- **energyFlows**: Waerme (`heat`) und Arbeit (`work`) mit Vorzeichen-Konvention:
  `value > 0` = Zufuhr, `value < 0` = Abfuhr. `location` referenziert ein Segment ("1-2")
  oder den gesamten Prozess ("global").
- **gasContext**: Stoffeigenschaften fuer Referenzlinien und Kurvenberechnung.
- **processDirection**: `clockwise` = Kraftmaschine, `counterclockwise` = Waerme-/Kaeltemaschine.

## CurveTypes und Formeln

| CurveType    | p-v Formel               | T-s Formel                        |
|-------------|--------------------------|-----------------------------------|
| adiabatic   | p = C / v^kappa          | s = const (Vertikale)             |
| isothermal  | p = C / v                | T = const (Horizontale)           |
| isobaric    | p = const                | T = T_ref * exp((s - s_ref) / cp) |
| isochoric   | v = const                | T = T_ref * exp((s - s_ref) / cv) |
| polytropic  | p = C / v^n              | Linear interpoliert               |

## Neuen Adapter schreiben (Schritt-fuer-Schritt)

1. Erstelle `src/modules/<name>/diagram.ts`
2. Exportiere eine Funktion `get<Name>DiagramSpec(values) => DiagramSpec | null`
3. Baue `statePoints` aus den berechneten Werten (`values[id]?.value ?? null`)
4. Definiere `segments` mit den korrekten `processType`-Werten
5. Fuege `energyFlows` hinzu (q_in, q_out, w_netto etc.)
6. Setze `processDirection` basierend auf w_netto
7. Gib `null` zurueck wenn weniger als 2 Punkte vollstaendig sind
8. Registriere in `index.ts`: `getDiagramSpec: get<Name>DiagramSpec`

Referenz-Implementierung: `src/modules/carnot/diagram.ts`

## SVG-Koordinatensystem

- viewBox: `0 0 480 300` (feste Proportionen, responsive via `width="100%"`)
- Padding: `{ left: 55, right: 20, top: 15, bottom: 40 }`
- p-v: Logarithmische Achsen (logMap)
- T-s: Lineare Achsen (linMap)
- Scale-Funktionen in `src/utils/diagram-scales.ts`
- Kurvenberechnung in `src/utils/curve-math.ts`

## Dateistruktur

```
src/components/diagrams/
  DiagramPanel.tsx          <- Container: holt DiagramSpec, rendert beide Diagramme
  PVDiagram.tsx             <- p-v Diagramm (SVG)
  TSDiagram.tsx             <- T-s Diagramm (SVG)
  shared/
    Axes.tsx                <- SVG-Achsen mit Labels und Auto-Ticks
    ProcessCurve.tsx        <- Ein Kurvensegment (SVG path)
    StatePointMarker.tsx    <- Beschrifteter Punkt mit Hover-Tooltip
    ReferenceLine.tsx       <- Gestrichelte Hintergrundlinie
    EnergyArrow.tsx         <- Waerme-/Arbeitspfeil
    DirectionMarker.tsx     <- Umlaufrichtungs-Pfeil auf Kurve
    Tooltip.tsx             <- Hover-Tooltip Komponente

src/utils/
  curve-math.ts             <- Parametrische Kurvenberechnung (sampleCurve_pv, sampleCurve_ts)
  diagram-scales.ts         <- Auto-Zoom, Achsen-Ranges, Tick-Berechnung
```

## Bekannte Einschraenkungen

- **Polytrope Overlay (mittlere Wirklinie):** Noch nicht implementiert. Ein passendes
  `DiagramOverlay`-Interface wird bei Bedarf als Teil des jeweiligen Moduldesigns festgelegt.
- **EnergyArrow-Positionierung:** Aktuell werden alle Pfeile am Diagramm-Zentrum platziert,
  auch wenn `location` ein spezifisches Segment referenziert. Segment-spezifische Platzierung
  ist als Verbesserung geplant.
- **Sehr kleine Wertebereiche:** Wenn alle v-Werte identisch sind (z.B. rein isochorer Prozess),
  kann die Log-Scale Division-by-Zero erzeugen. Der Range-Berechner gibt in diesem Fall `null`
  zurueck und das Diagramm wird nicht gerendert.
