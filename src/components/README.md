# UI-Komponenten (`src/components/`)

Wiederverwendbare React-Komponenten für den Ingenieursrechner.

## Komponenten

| Komponente | Zweck |
|------------|-------|
| `CalculatorTable.tsx` | Editierbare Wertetabelle (Haupteingabe) |
| `StepDisplay.tsx` | KaTeX-gerenderte Rechenschritte |
| `ValueInput.tsx` | Einzelnes Eingabefeld mit Validierung |
| `UnitSelector.tsx` | Dropdown für Einheitenauswahl |
| `ProcessSelector.tsx` | Dropdown für Prozesstypen |
| `ModuleSelector.tsx` | Navigation zwischen Rechner-Modulen |
| `FormulaReference.tsx` | Seitenleiste mit Formelsammlung |

## Styling
- Tailwind CSS v4 mit CSS-Variablen (definiert in `src/index.css`)
- Dark Theme als Standard
- Farben über CSS Custom Properties: `--bg-primary`, `--accent`, `--error`, etc.

## State
- UI-State kommt aus dem Zustand Store (`src/store/calculator-store.ts`)
- Hooks in `src/hooks/` verbinden Store mit Komponenten
- Live-Berechnung: Jede Eingabe-Änderung triggert sofort den Solver
