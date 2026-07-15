# Modul: Carnot-Prozess

## Was dieses Modul berechnet

Der ideale Carnot-Kreisprozess — der theoretisch effizienteste Wärmekraftmaschinen-Zyklus
zwischen zwei Temperaturniveaus. Das Modul berechnet aus beliebig vielen gegebenen
Zustandsgrößen automatisch alle ableitbaren Werte: Drücke, Volumina, Temperaturen
an allen vier Zustandspunkten sowie Energiebilanz und Wirkungsgrad.

**Typische Aufgabenstellung:** Gegeben T1, T3, p2, p3, Rs, κ → berechne alle Zustandsgrößen + η.

---

## Zustandspunkte und Prozesse

```
Z1 --[adiabat, q=0]-------→ Z2   Kompression (kalt → warm)
Z2 --[isotherm, T_warm]---→ Z3   Expansion   (Wärmezufuhr q_in > 0)
Z3 --[adiabat, q=0]-------→ Z4   Expansion   (warm → kalt)
Z4 --[isotherm, T_kalt]---→ Z1   Kompression (Wärmeabfuhr q_out < 0)
```

| Zustand | Temperatur    | Bedeutung                            |
|---------|---------------|--------------------------------------|
| Z1      | T_kalt = T1   | Start adiabate Kompression           |
| Z2      | T_warm = T2   | Start isotherme Expansion (heiß)     |
| Z3      | T_warm = T3   | Ende isotherme Expansion             |
| Z4      | T_kalt = T4   | Ende adiabate Expansion              |

**Isotherme Gleichheiten:**
- `T2 = T3 = T_warm` (heiße Isotherme 2→3)
- `T4 = T1 = T_kalt` (kalte Isotherme 4→1)

**Wirkungsgrad:** `η = 1 - T1/T3 = 1 - T_kalt/T_warm`

---

## Vorzeichen-Konvention (Physikalisch)

| Größe    | Vorzeichen | Bedeutung                           |
|----------|------------|-------------------------------------|
| `q_in`   | **> 0**    | Wärme wird dem System zugeführt     |
| `q_out`  | **< 0**    | Wärme verlässt das System           |
| `w_netto`| **< 0**    | Arbeit wird vom System abgegeben    |

**1. Hauptsatz (Kreisprozess):** `w_netto = -(q_in + q_out)`

**Isotherme Wärme aus ∫p dV:**
- Heiße Isotherme: `q_in  = Rs · T3 · ln(v3/v2)` — positiv (v3 > v2, Expansion)
- Kalte Isotherme: `q_out = Rs · T1 · ln(v1/v4)` — negativ (v1 < v4, Kompression)

**Wirkungsgrad aus Energien:** `η = -w_netto / q_in` (Vorzeichen-Invertierung wegen w_netto < 0)

---

## Variablen

**Pro Zustand (×4):**
- `pi` — Druck [Pa]
- `Vi` — Volumen (extensiv) [m³]  — braucht Gasmasse m
- `Ti` — Temperatur [K]
- `rhoi` — Dichte [kg/m³]
- `vi` — Spezifisches Volumen [m³/kg]  — kein m nötig

**Stoffeigenschaften (global):**
- `m`     — Gasmasse [kg]
- `Rs`    — Spezifische Gaskonstante [J/(kg·K)]
- `M`     — Molare Masse [kg/mol]
- `kappa` — Isentropenexponent [-]
- `cv`, `cp` — Spezifische Wärmekapazitäten [J/(kg·K)]

**Spezifische Entropie (pro Zustand):**
- `si`      — Spezifische Entropie [J/(kg·K)]  (Bezug: T0=273.15 K, p0=101325 Pa, s0=0)

**Energiebilanz (global):**
- `q_in`    — Zugeführte spezifische Wärme [J/kg]  (> 0)
- `q_out`   — Abgeführte spezifische Wärme [J/kg]  (< 0)
- `w_netto` — Spezifische Netto-Arbeit [J/kg]       (< 0)
- `eta`     — Thermischer Wirkungsgrad [-]            (0…1)

---

## Formelkategorien

| Kategorie          | Formeln                                                      |
|--------------------|--------------------------------------------------------------|
| Zustandsgleichung  | `p·V = m·Rs·T` und `p·v = Rs·T` für Z1–Z4                 |
| Dichte / spez. Vol.| `ρ = m/V`, `v = V/m`, `ρ = 1/v`, `p = ρ·Rs·T` für Z1–Z4  |
| Stoffeigenschaften | Mayer: `cp = cv + Rs`, κ-Def: `κ = cp/cv`, `Rs = R/M`      |
| Isotherm Constraints| `T2 = T3`, `T4 = T1`                                       |
| Adiabate Übergänge | `T·v^(κ-1) = const`, `p·v^κ = const` für [1→2] und [3→4]  |
| Isotherme Wärme    | `q_in = Rs·T3·ln(v3/v2)`, `q_out = Rs·T1·ln(v1/v4)`       |
| Entropie           | `s1=s2`, `s3=s4`, `si = cp·ln(Ti/T0) - Rs·ln(pi/p0)`      |
| Entropie-Differenz | `s3-s1 = q_in/T3`, `s3-s1 = -q_out/T1`                     |
| Wirkungsgrad       | `η = 1 - T1/T3`, `η = -w_netto/q_in`                       |
| Energiebilanz      | `w_netto = -(q_in + q_out)`                                 |

---

## Architektur-Besonderheiten

**Statisches Modul:** Feste Variablenanzahl, kein Parameter-Input. Passt direkt ins
Standard-Modul-Schema (`config: ModuleConfig`, nicht `getConfig(params)`).

**Formel-Generierung:** Adiabate, Dichte- und Gasgleichungs-Formeln werden per Loop
generiert (über die Zustandsindizes 1–4), nicht manuell ausgeschrieben. Fehler im
Generator betreffen daher ALLE Formeln dieser Kategorie.

**Kein Prozesstyp-Filter aktiv:** Die Carnot-Struktur ist fest definiert — Formeln
haben kein `applicableProcesses`. Alle Formeln sind immer aktiv.

**Spezifisches vs. extensives Volumen:** `v` (m³/kg) kann ohne Gasmasse `m` bestimmt
werden. `V` (m³) braucht zwingend `m`. Beide Varianten sind im Modul vorhanden.

---

## Reference preset

The module exposes `reference-air`, a deterministic onboarding and regression case:

- T1 = 250 K
- T3 = 500 K
- p2 = 1 MPa
- p3 = 200 kPa
- Rs = 287 J/(kg·K)
- κ = 1.4

The expected efficiency is 50%. The preset is defined in `index.ts`; the generic store loads module presets without Carnot-specific branching.

---

## Bekannte Einschränkungen und offene Punkte

- Nur ideales Gas (`p·v = Rs·T` gilt exakt)
- κ als konstant angenommen (keine Temperaturabhängigkeit)
- Zirkuläre Abhängigkeiten (implizite Gleichungen) kann der Fixed-Point-Solver nicht lösen
- Extensive volumes `V` require gas mass `m`; specific volumes `v` remain solvable without it
- No alternative calculation paths are shown side by side in the UI

---

## Kontextdateien

- Variablen: `src/modules/carnot/config.ts`
- Formeln:   `src/modules/carnot/formulas.ts`
- Export:    `src/modules/carnot/index.ts`
- Tests:     `tests/core/solver.test.ts`, `tests/modules/carnot/`
