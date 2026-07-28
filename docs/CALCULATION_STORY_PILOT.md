# Calculation-Story Pilot

## Status and scope

This is a bounded learner-facing pilot for the Joule/Brayton material-property branch. It replaces legacy per-step cards only when one of its two finite, evidenced route signatures is selected:

1. `R_s + kappa -> c_v -> c_p`
2. `c_v + kappa -> c_p`

All other Joule paths remain on the existing presentation plan and `StepDisplay`. The pilot never changes solver selection, formulas, accepted values, units, diagrams, summaries, or validation.

## Semantic row contract

A recipe returns rows rather than a formatted monolithic LaTeX document:

| Field | Meaning |
|---|---|
| `kind` | `governing`, `transform`, `result`, `numeric`, or `reuse` |
| `equationLatex` | Render-ready equation assembled from module variable metadata and final values |
| `operation` | Named learner-visible algebra operation |
| `note` | Short row-attached condition or interpretation |
| `state` | `derived` for an isolated but not yet reachable relation; `reachable` for a fact whose prerequisites are available |

The renderer maps these rows to an operation column, a continuous equation spine, and attached notes. It uses the existing KaTeX utility; the recipe is not a source database of opaque final document strings.

## Route examples

### Reference: `R_s + kappa -> c_v -> c_p`

The selected solver directions remain `cv_from_Rs_kappa:cv` and `cp_from_kappa_cv:cp`. The explanation exposes the approved conceptual bridge:

1. `kappa = c_p / c_v` becomes the thin, derived relation `c_p = kappa c_v`.
2. `R_s = c_p - c_v` receives that relation by named substitution.
3. Factor `c_v`, then divide by `kappa - 1` to obtain the reachable `c_v` fact.
4. Insert the exact final solver value for `c_v`.
5. Reuse the already proven `c_p = kappa c_v` relation, then insert the exact final solver value for `c_p`.

The proof appears once; the later `c_p` use is explicitly `reuse`, not a second derivation.

### Direct route: `c_v + kappa -> c_p`

When `c_v` and `kappa` are user facts and the planner selects `cp_from_kappa_cv:cp`, the story shows only the governing relation, the reachable isolated `c_p = kappa c_v`, and the exact solver value. It intentionally does not invent an `R_s` elimination.

## Truth, availability, and isolation

The adapter receives selected route identity, `SolutionStep` provenance, and immutable final solver values. It verifies the required selected directions and solver steps before producing a story. A selected pilot route with missing evidence returns an explicit German unavailable state. A non-pilot route returns `not-applicable` and preserves legacy presentation.

The store calls the adapter after the solver and presentation plan. Exceptions are converted to unavailable output; they cannot change accepted numeric values. Invalid-after-valid input transitions clear the old story instead of preserving stale derivation rows.

## Mobile behavior

At widths up to 760 px, notes move below the associated equation row. Each equation is a keyboard-focusable, labelled local horizontal scroller with touch `pan-x`; its equation content has a bounded minimum width so long fractions and unit expressions retain their mathematical structure. The page layout itself remains constrained to the viewport.

## Non-goals

- general symbolic algebra, expression parsing, or CAS behaviour;
- a generic formula/proof database;
- runtime LLM text or derivation generation;
- recomputing values in the presentation layer;
- a solver, planner, formula, dependency, workflow, or module rewrite;
- replacing non-pilot Joule paths or other modules.

## Extension and test protocol

Add a route only when its planner direction identity, source relations, conditions, semantic row order, and expected values are known. Add a failing recipe test first, then a store test when integration changes, and a component/KaTeX test when render semantics change. Do not make a recipe broadly match “similar” routes.

## Requirement-to-evidence record

| Requirement | Evidence |
|---|---|
| REQ-CS-01: reference proof uses selected solver facts | `tests/modules/joule/calculation-story.test.ts` |
| REQ-CS-02: direct `c_v + kappa` path differs truthfully | `tests/modules/joule/calculation-story.test.ts` |
| REQ-CS-03: story cannot mutate solver state; stale output clears | `tests/store/calculator-store.test.ts` |
| REQ-CS-04: equations render through KaTeX | `tests/modules/joule/rendering.test.ts`, `tests/components/calculation-story-display.test.tsx` |
| REQ-CS-05: local labelled keyboard scroller and explicit unavailable state | `tests/components/calculation-story-display.test.tsx` |
| REQ-CS-06: existing calculator gates remain intact | `npm run verify` and pull-request checks |

## Implementation observations

- The live repository already had the required finite route planner, selected-route identity, provenance, presentation plan, module metadata, and KaTeX utility. A new solver or planner layer would have been duplication.
- The numerical formula `c_v = R_s/(kappa - 1)` is a legitimate solver direction but not a sufficient learner-facing governing entry point. The recipe therefore adds the approved two-relation bridge only in presentation, without touching numerical execution.
- Final story numbers must use `SolverResult.values` before display-unit conversion; using store display values would silently violate the canonical-value boundary.
- Zustand shallow state replacement exposed a real stale-output risk: an early invalid-input result that omitted `story` retained the prior story. The invalid branch now explicitly clears it.
- The pilot deliberately stops at the material-property proof spine. Extending it to the full Joule cycle needs new finite recipes and route-specific acceptance tests, not a generic fallback.
- Verification gap recorded after execution: `npm test`, lint, and build pass locally and in pull-request CI, but the canonical audit gate remains red on the pre-existing five-high `brace-expansion` dependency chain. This pilot changes neither dependencies nor the lockfile; remediation is deliberately outside scope.
