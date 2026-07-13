---
status: completed
completed: 2026-03-04
---

# Solver-Robustheit: Jede gültige Eingabekombination muss funktionieren

## Ergebnis

**66/66 Tests grün** — alle 22 Eingabekombinationen + 5 Property-Based Tests (500 Zufallswerte).

## Was gemacht wurde

### Neue Dateien
| Datei | Beschreibung |
|---|---|
| `tests/helpers/carnot-golden-state.ts` | Golden-State-Generator (30 Variablen aus 6 Parametern) |
| `tests/helpers/carnot-golden-state.test.ts` | 16 Tests: Konsistenz des Generators selbst |
| `tests/helpers/carnot-input-sets.ts` | 22 benannte Eingabe-Subsets (Kategorien A-F) |
| `tests/core/solver-robustness.test.ts` | 22 parametrisierte Tests mit festen Referenzwerten |
| `tests/core/solver-property.test.ts` | 5 Property-Based Tests mit fast-check (100 Runs je) |

### Geänderte Dateien
| Datei | Änderung |
|---|---|
| `src/modules/carnot/formulas.ts` | Neue Formel `cv_from_Rs_kappa`: `cv = Rs/(κ-1)` |
| `src/modules/carnot/TASKS.md` | BUG-4 Status aktualisiert, BUG-6 als erledigt eingetragen |
| `package.json` | `fast-check` als devDependency |

### Gefundener und behobener Bug
**BUG-6: cv und cp nie berechenbar aus Rs+κ**
- Ursache: Mayer + kappa_def = 2 Gleichungen mit 2 Unbekannten → Fixed-Point-Solver blockiert
- Fix: Abgeleitete Formel `cv = Rs/(κ-1)` bricht den Deadlock

### BUG-4 Ergebnis
- **Solver-seitig kein Bug.** Alle D-Kategorie-Tests (p+T bekannt → v berechnen) sind grün.
- Verbleibender Verdacht: UI/Store Einheiten-Konvertierung (Bar→Pa).

## Testabdeckung nach Session
- Vorher: 23 Tests
- Nachher: 66 Tests (+43)
- 22 verschiedene Eingabekombinationen getestet
- 500 zufällige Wertekombinationen (Property-Based)
