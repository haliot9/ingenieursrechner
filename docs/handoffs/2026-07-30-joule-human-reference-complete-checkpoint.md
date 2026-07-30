# PR #25 Joule human-reference complete implementation checkpoint

- Date: 2026-07-30
- Packet: `pr25-joule-human-reference-complete-implementation`
- Base commit/tree: `d63a953eb71b5c8dfd61ed1a5b1b33be7d139f2e` / `06fa3ea470c7e319ab854ac0c55ed2f80091e440`
- Implementation commit/tree: `efc82a7f85350d1ae45e95e63e148168869f4517` / `d6d42adb3aee79923a66bf351f56846f5e3a2741`
- Parent: `d63a953eb71b5c8dfd61ed1a5b1b33be7d139f2e`
- Scope: bounded Joule calculation-story presentation only; solver, formula registry, quantities, units, config, App, dependencies, lockfile, CI, lint config, and build config unchanged.

## Source integrity

The dispatch packet, QM matrix, target HTML, annotated rationale, agenda, delta contract, target evidence, and rejection correction were SHA-256 rechecked after implementation. All matched their packet-declared canonical hashes.

## Implemented delta

- Replaced the rejected generic/legacy story composition with the frozen seven-section human-reference route.
- Added a finite 62-row live-solver composition with 26 consumer-attached support blocks (25 open, one collapsed).
- Added explicit formula-local `outline` and `ready` fact boxes (five and 22 respectively), four-track rendering, main-path-only control, and responsive attached-support stacking CSS.
- Kept display values derived from current solver state and verified an altered `T3` scenario changes the visible `q_in` value while retaining the narrative grammar.
- Removed superseded test assertions for the rejected ~150-row story and replaced them with structural, content, renderer, support, fact-state, live-value, main-only, and focus evidence.

## Requirement and DVP&R evidence

| Requirement | DVP&R | Actual result | Verdict |
|---|---|---|---|
| REQ-JHR-001 binding composition | DVPR-JHR-001 | `calculation-story-full.test.ts`: exact seven titles/order and 62 rows passed. | pass |
| REQ-JHR-002 attached proof track | DVPR-JHR-002 | 26 supports, valid consumer ownership, 25 open/one collapsed; model and component assertions passed. | pass |
| REQ-JHR-003 four-track grammar | DVPR-JHR-003 | Typed operation/equation/support rows, continuation subject suppression, representative relation assertions and component rendering passed. | pass |
| REQ-JHR-004 fact-state semantics | DVPR-JHR-004 | Five outline and 22 ready formula-local grids passed; no row-wide fact-state assertion is used. | pass |
| REQ-JHR-005 didactic content/no telemetry | DVPR-JHR-005 | Entropy bridge, energy path, extensive-to-specific transition, conditions, signs, reuse, and forbidden telemetry assertions passed. | pass |
| REQ-JHR-006 live values | DVPR-JHR-006 | Reference and altered `T3=1500 K` paths use current solver values and produce different displayed `q_in`. | pass |
| REQ-JHR-007 main-only | DVPR-JHR-007 | Component test preserves 62 main rows while hiding/restoring all 26 supports. | pass |
| REQ-JHR-008 responsive semantics | DVPR-JHR-008 | CSS implements desktop attached track and narrow semantic stacking; deterministic component coverage passed. Exact-head 390px browser gate remains Toka-owned. | partial |
| REQ-JHR-009 focus | DVPR-JHR-009 | Existing App focus test passed with value-state preservation before/after focus toggle. | pass |
| REQ-JHR-010 regression containment | DVPR-JHR-011 | Full test, lint, production build, protected path checks, and source-hash recheck passed. The repository `npm audit --audit-level=high` gate remains blocked by five pre-existing transitive high findings; no dependency mutation is authorized. | partial |

## FMEA action evidence

- FMEA-JHR-001/002: red-first seven-section/62-row and required-content tests prevent the prior 150-row/raw-order regression.
- FMEA-JHR-003/004/005: typed consumer support, four-track DOM, and formula-local state assertions passed.
- FMEA-JHR-006: forbidden learner-facing telemetry assertions passed.
- FMEA-JHR-007: changed-input live-solver assertion passed; protected numerical paths unchanged.
- FMEA-JHR-008: main-only and focus state-preservation tests passed.
- FMEA-JHR-009: CSS/component candidate exists; exact-head 390px browser evidence is pending.
- FMEA-JHR-010: protected-path diff produced no paths.

## Executed verification

- RED before production: `npm test -- --run tests/modules/joule/calculation-story-full.test.ts` failed 5 intended structural/content assertions against the old artifact.
- Targeted final: `npm test -- --run tests/modules/joule/calculation-story-full.test.ts tests/modules/joule/calculation-story.test.ts tests/modules/joule/rendering.test.ts tests/components/calculation-story-display.test.tsx tests/components/app-calculation-story-focus.test.tsx` — 5 files, 25 tests passed.
- Full suite: `npm test` — 39 files, 195 tests passed.
- Lint: `npm run lint` — passed.
- Production build: `npm run build` — passed; Vite reported only its chunk-size warning for the existing 1.26 MB JavaScript output.
- `git diff --check` — passed.
- Allowed-path diff — eight implementation/test paths only before this checkpoint; protected-path diff empty.
- `npm run verify` — tests, lint, and production build passed; `npm audit --audit-level=high` failed with five high-severity transitive `brace-expansion` findings through `minimatch`/ESLint. The offered remediation is `npm audit fix --force` and upgrades ESLint to 10, a breaking dependency/lockfile mutation outside the authorized paths.

## Residuals and gate status

- No product PASS, merge, release, or human screenshot request is made here.
- DVPR-JHR-008 needs Toka's exact-head desktop and 390px browser gate after publication/transfer.
- DVPR-JHR-010 needs Yuna's pedagogical review; G4 needs Juri's independent exact-head audit. Nested dispatch was forbidden and no dispatch occurred.
- The repository audit gate is blocked by five high-severity transitive dependency findings. The available automatic fix requires an unauthorized breaking ESLint/lockfile change; this run did not apply it.
- This implementation is locally committed only; no push, merge, deploy, rebase, reset, or force-push occurred.
