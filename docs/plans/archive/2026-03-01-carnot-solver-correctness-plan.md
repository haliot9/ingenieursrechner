---
module: carnot-solver-correctness
status: completed
tags: [carnot, solver, isothermal, adiabatic, zustandsberechnung]
started: 2026-03-01
last-updated: 2026-03-01
---

# Plan: Solver-Korrektheit Carnot-Modul — ABGESCHLOSSEN ✓

## Korrekte Carnot-Konvention (finale Definition)

```
Prozess: 1 →[adiabat]→ 2 →[isotherm warm]→ 3 →[adiabat]→ 4 →[isotherm kalt]→ 1

T1 = T4 = T_kalt   (kalte Isotherme 4→1)
T2 = T3 = T_warm   (heiße Isotherme 2→3)

η = 1 - T1/T3  (T1=kalt, T3=warm)
```

## Alle behobenen Bugs

### BUG-1 + BUG-3: Falsche Prozessstruktur und fehlende Constraints

**Ursachen:**
1. `carnot_eta` hatte umgekehrte Konvention: `1 - T3/T1` statt `1 - T1/T3`
2. Isotherme Constraints fehlten komplett → Solver konnte T2 und T4 nie ableiten
3. Adiabate Formeln für falsche Paare generiert ([2,3]+[4,1] statt [1,2]+[3,4])
4. `applicableProcesses: ['adiabatic']` blockierte alle adiabaten Formeln
   (Store initialisiert `activeProcesses = {}` → kein Formel je aktiv)

**Fix in `src/modules/carnot/formulas.ts`:**
- `carnot_eta`: `eta = 1 - T1/T3` (T1=kalt, T3=warm)
- Adiabate Paare: nur [1,2] und [3,4] (Kompression und Expansion)
- `applicableProcesses` aus allen Carnot-Formeln entfernt (immer aktiv)
- Neue Funktion `generateIsothermalTFormulas()`: `T2=T3` und `T4=T1`
- Neue Funktionen `generateAdiabaticTvFormulas()` + `generateAdiabaticPvFormulas()`:
  T·v^(κ-1)=const und p·v^κ=const für spezifisches Volumen (kein m nötig)

### BUG-2: q_out Vorzeichen
q_out ist positiver Betrag (abgeführte Wärme). Beide Wege liefern dasselbe:
- `q_out = q_in - w_netto` (Energiebilanz)
- `q_out = Rs * T1 * ln(v4/v1)` (Isotherme Wärmeformel)
→ kein Bug, Convention ist korrekt.

### Neue Feature: q_in → v2 Berechnung
`generateIsothermalHeatFormulas()` added:
- `q_in = Rs·T3·ln(v3/v2)` mit allen Umformungen (auch v2 und v3 lösbar)
- `q_out = Rs·T1·ln(v4/v1)` analog

## Verifizierte Referenzwerte (Testaufgabe)

Eingaben: T1=250 K (kalt), T3=500 K (warm), p2=1 MPa, p3=200 kPa, Rs=287 J/(kg·K), κ=1.4

| Variable | Erwartet | Solver | |
|----------|----------|--------|-|
| η        | 0.5      | 0.5    | ✓ |
| T2       | 500 K    | 500 K  | ✓ |
| T4       | 250 K    | 250 K  | ✓ |
| v2       | 0.1435   | 0.1435 | ✓ |
| v3       | 0.7175   | 0.7175 | ✓ |
| v1       | 0.8119   | 0.8118 | ✓ |
| v4       | 4.059    | 4.059  | ✓ |
| q_in     | ~231k    | 230954 | ✓ |
| q_out    | ~115k    | 115477 | ✓ |
| w_netto  | ~115k    | 115477 | ✓ |

## Geänderte Dateien (diese Session)
- `src/modules/carnot/formulas.ts` — komplette Neustrukturierung
- `tests/core/solver.test.ts` — alle Tests auf korrekte Konvention aktualisiert (23/23 ✓)

## Tests
```
23/23 passed ✓
```

## Nächste Schritte (neue Session)
- UI-Test mit echter Aufgabe aus der Bug-Meldung (v1=1.11 etc.)
- Neue Module (Diesel, Otto) — dann Prozessauswahl-UI relevant
