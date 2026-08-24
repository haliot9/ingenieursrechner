# Rechner-Module (`src/modules/`)

Jedes Modul ist ein eigenständiger Rechner für ein Themengebiet (z.B. Thermodynamik, Kinematik).

## Vorhandene Module
- `carnot/` → Carnot-Kreisprozess (Thermodynamik)
- `diesel/` → idealer Luftstandard-Diesel-Kreisprozess (Thermodynamik)
- `otto/` → idealer Luftstandard-Otto-Kreisprozess (Thermodynamik)
- `joule/` → statischer idealer Joule-/Brayton-Kreisprozess (Thermodynamik)

## Neues Modul erstellen

### 1. Ordner anlegen
```bash
cp -r src/modules/_template src/modules/mein_modul
```

### 2. `config.ts` bearbeiten
Definiere alle Variablen mit:
- `id` (eindeutig, z.B. "v1", "a_max")
- `symbol` (Unicode für UI, z.B. "v₁")
- `latex` (LaTeX-Symbol, z.B. "v_1")
- `defaultUnit` (SI-Einheit)
- `constraints` (physikalische Grenzen)
- `group` (für UI-Gruppierung)

### 3. `formulas.ts` bearbeiten
Für JEDE Formel definieren:
- `solveFor`: Math.js Expression für JEDE lösbare Variable
- `latexSteps`: LaTeX der umgestellten Formel + Erklärungstext
- `variables`: Array der beteiligten Variable-IDs

For a module that opts into planned execution or a Calculation Story, also declare and test:

- `formulaId:targetId` direction modes, conditions, and deterministic route priority;
- post-solve validation for redundant user facts;
- proof authority for every direction the Story may consume;
- narrative context, diagram projection, and truthful generic fallback behaviour.

The complete identity, ownership, synthesis, and coverage contract lives in [`docs/DERIVATION_ARCHITECTURE.md`](../../docs/DERIVATION_ARCHITECTURE.md). Do not create one hard-coded story per complete input scenario and do not let rendering infer algebra from LaTeX strings.

### 4. In Registry registrieren
In `src/modules/index.ts` das Modul importieren und in `MODULES` eintragen.

### 5. Tests schreiben
In `tests/modules/<name>/`, cover every active direction changed by the module, its physical invariants, redundant-consistent and contradictory inputs, deterministic route behaviour, diagram projection, and any story/provenance contract. Use independent expected values; a minimum example count is not a substitute for risk coverage.

## Architektur-Regeln
- Module kennen nur `core/types.ts` - keine direkte UI-Abhängigkeit
- Formeln müssen für ALLE lösbaren Variablen `solveFor` haben
- Einheiten intern immer in SI

## joule

Static ideal Joule/Brayton cycle module. Module-local files own the pressure-ratio contract (pressureRatio), formulas, typed contradiction checks, and diagram mapping.
