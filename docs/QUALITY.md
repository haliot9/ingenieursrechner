# Carnot Release Quality Evidence

Date: 2026-07-13
Scope: Carnot calculator public web release

## Acceptance requirements

| ID | Requirement | Evidence | Status |
|---|---|---|---|
| REQ-01 | Reference inputs solve the complete intensive Carnot state and energy balance | `tests/core/solver.test.ts`, `tests/core/solver-robustness.test.ts`, `tests/store/calculator-store.test.ts` | Verified |
| REQ-02 | Efficiency follows $1 - T_{cold}/T_{hot}$ and the documented sign convention | solver and golden-state tests | Verified |
| REQ-03 | Invalid computed results are rejected by variable constraints | `tests/core/solver-constraints.test.ts` | Verified |
| REQ-04 | Display-unit changes do not alter SI diagram physics or energy labels | `tests/utils/module-values.test.ts`, `tests/components/diagram-panel.test.tsx` | Verified |
| REQ-05 | Reset clears visible user drafts | `tests/components/value-input.test.tsx` | Verified |
| REQ-06 | Integer trailing zeros remain significant in the UI | `tests/components/value-input.test.tsx` | Verified |
| REQ-07 | p-v and T-s diagram data is generated from solved states | `tests/modules/carnot/diagram.test.ts`, diagram scale/curve tests | Verified |
| REQ-08 | Production TypeScript/Vite build succeeds | `npm run build` | Verified |
| REQ-09 | Source passes ESLint | `npm run lint` | Verified |
| REQ-10 | The dependency tree has no known npm audit findings | `npm audit` | Verified |
| REQ-11 | The initial interaction path is usable at an iPhone-class 390×844 viewport | Headless Chrome screenshot `/tmp/ingenieursrechner-iphone.png` | Verified locally |
| REQ-12 | GitHub Pages serves the committed production build | GitHub Actions Pages run + public browser verification | Verified |
| REQ-13 | Only non-degenerate Carnot engine operation is accepted (`T3>T1`, `κ>1`, documented energy signs) | validator, store, and Carnot cycle validation tests | Verified |
| REQ-14 | Redundant inputs violating central Carnot invariants are reported as contradictions | `tests/modules/carnot/validation.test.ts`, store test | Verified |

## Main failure modes and controls

| Failure mode | User effect | Control |
|---|---|---|
| Corrupted dependency tree | tests/build fail before app code loads | lockfile + `npm ci` |
| Hot/cold temperatures reversed | negative or >100% efficiency | computed-result constraint validation |
| Input formatting removes significant zeros | pressure displayed incorrectly | component regression test |
| Reset leaves stale visible drafts | UI disagrees with store | component regression test |
| Display-unit values enter SI-labelled diagrams | physically false axes and energy labels | canonical-unit adapter + component acceptance test |
| Reversed or degenerate engine operation is accepted | refrigerator/zero-cycle reported as engine | strict sign/temperature/κ constraints + cycle validation |
| Redundant inputs contradict Carnot invariants | plausible-looking but internally inconsistent result | module-level contradiction validation |
| Partial but useful solution reported as hard failure | user distrusts valid results | hide insufficient-data warning once the core cycle is solved |
| Desktop table overflows on phone | calculator unusable on iPhone | mobile card layout and 44 px controls |
| Public deployment regresses | no usable link | GitHub Pages workflow runs build before deployment |

## Release gate

Local gate: **PASS**

Verified locally:

- 104 automated tests pass
- lint passes
- production build passes
- npm audit reports zero vulnerabilities
- reference case renders 50% efficiency with both diagrams
- 390×844 initial viewport has no visible horizontal overflow

Publication gate: **PASS**

Verified publicly:

- GitHub Pages workflow build and deploy jobs completed successfully
- public URL returned the production application
- reference preset rendered 50% efficiency, energy values, p-v/T-s diagrams, and 23 calculation steps
- public browser console reported zero JavaScript errors
