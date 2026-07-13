# Core Engine (`src/core/`)

Die Rechner-Engine ist das Herzstück des Ingenieursrechners. Sie ist komplett unabhängig von React/UI und kann isoliert getestet werden.

## Dateien

| Datei | Zweck |
|-------|-------|
| `types.ts` | Alle TypeScript Interfaces (Variable, Formula, SolutionStep, etc.) |
| `solver.ts` | Fixed-Point-Iterations-Solver - berechnet unbekannte Werte |
| `formula-registry.ts` | Verwaltet Formeln, Index nach Variablen |
| `step-tracker.ts` | Zeichnet Rechenschritte auf, formatiert LaTeX |
| `unit-converter.ts` | Einheiten-Konvertierung via math.js |
| `validator.ts` | Input-Validierung, Plausibilitätsprüfung |

## Solver-Algorithmus
```
Input: Bekannte Variablen + Formel-Registry
  ↓
Loop:
  → Finde Formeln mit genau 1 Unbekannten
  → Löse Unbekannte auf (math.js evaluate)
  → Speichere Rechenschritt
  → Markiere Variable als bekannt
  → Wiederhole bis nichts mehr lösbar
  ↓
Output: Alle berechneten Werte + Schritte + Fehler
```

## Wichtig für Änderungen
- `types.ts` ist die Single Source of Truth für alle Interfaces
- Änderungen an types.ts haben Auswirkungen auf ALLE anderen Dateien
- Der Solver muss IMMER deterministisch bleiben
- Neue Features erst in types.ts definieren, dann implementieren
