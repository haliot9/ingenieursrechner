# Joule / Brayton module

Static deterministic educational model of the ideal four-state Joule/Brayton heat-engine cycle.

## Topology and signs

1→2 is isentropic compression, 2→3 is isobaric heat input, 3→4 is isentropic expansion, and 4→1 is isobaric heat rejection. Repository signs remain `q_in > 0`, `q_out < 0`, `w_comp > 0`, `w_turb < 0`, and `w_netto < 0`.

## Reference learning story

The module follows the general identity, ownership, and proof-coverage contract in [`docs/DERIVATION_ARCHITECTURE.md`](../../../docs/DERIVATION_ARCHITECTURE.md). This README describes only the current Joule model and its reference-only activation boundary.

The Joule story is a presentation-only composition over the selected route and accepted final solver values. It mirrors every selected direction identity in `consumedSteps`, but the current composer does not yet reconcile its rows or family recipes against individual `SolutionStep` evidence. It begins with the model, givens, scope, signs, and dependency route; then follows state 1 → 2 → 3 → 4 before cycle performance. It models a simple ideal steady-flow cycle per unit mass: `v` is specific volume, while mass flow, total power, and transient piston systems are explicitly outside the module.

The frozen reference composer emits seven main sections, 62 main rows, and 26 support blocks. Rows carry typed semantic equations, `outline` or `ready` fact boxes, spacing roles, and typed operations. Support stays attached to its consuming row; 25 support blocks open initially and only the state-1 unit derivation starts collapsed. There are no current milestone rows or state-completion checkpoints.

`CalculationStoryDisplay` renders equation fragments with KaTeX and keeps keyboard-focusable local equation scrolling. Numeric story rows are formatted from accepted final solver values, not from `SolutionStep.substitutedLatex`. Pressure, temperature, specific-energy, and specific-heat rows carry units; the attached state-1 unit proof documents the specific-volume dimension, but current `v` numeric rows render their values without an explicit unit.

## Authority boundary

The story-family registry inventories all 44 numerical `derive` directions; the four `ideal_gas_n:Rs` directions remain validate-only. The numerical planner already uses those directions. Full Story activates only for the exact approved six-input reference preset and returns `not-applicable` for changed or additional inputs; the current composer does not yet consume the family registry as generalized proof authority.

The current reference composer supplies no `story.alternatives`. When a complete or unavailable Story is displayed, the calculator page suppresses the generic `StepDisplay` entirely. Changed or additional reference inputs return `not-applicable`, so those scenarios retain generic evidence. Partial Story and residual-evidence coexistence are Phase A work.

## Evidence

- `tests/modules/joule/calculation-story.test.ts`: selected-direction consumption, frozen row count, target-local support, the single initially collapsed unit block, and unavailable fallback for a missing accepted value.
- `tests/modules/joule/calculation-story-full.test.ts`: 44 derive / four validate-only direction-ID reconciliation, the seven-section 62-row / 26-support contract, typed fact rows, live solver values, and altered-scenario rejection.
- `tests/components/calculation-story-display.test.tsx`: section/grid structure, disclosure controls, main-path filtering, KaTeX, continuation semantics, local scrollers, and unavailable rendering.
- `tests/components/app-calculation-story-focus.test.tsx` and `app-metadata.test.tsx`: full-width placement, accepted result stability, exact reference activation, 22 consumed directions, and the current zero-legacy-card surface.
