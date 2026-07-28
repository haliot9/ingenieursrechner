# Joule / Brayton module

Static deterministic educational model of the ideal four-state Joule/Brayton heat-engine cycle.

## Topology and signs

1→2 is isentropic compression, 2→3 is isobaric heat input, 3→4 is isentropic expansion, and 4→1 is isobaric heat rejection. Repository signs remain `q_in > 0`, `q_out < 0`, `w_comp > 0`, `w_turb < 0`, and `w_netto < 0`.

## Learning story v0.2

The Joule story is a presentation-only composition over accepted solver provenance. It begins with the model, givens, scope, signs, and dependency route; then follows state 1 → 2 → 3 → 4 before cycle performance. It models a simple ideal steady-flow cycle per unit mass: `v` is specific volume, while mass flow, total power, and transient piston systems are explicitly outside the module.

Rows carry typed semantic equations, explicit result-core box semantics, milestones, spacing roles, section tiers, and optional collapse state. Reusable first-use relations are proven once; their bridge remains outside one boxed equation core, and subsequent process rows reuse that proof. State completion is a non-equation checkpoint. The optional relative-entropy datum is collapsed by default and contains the full finite micro-step integration sequence. The main spine does not require it.

`CalculationStoryDisplay` renders every equation fragment with KaTeX display math and keeps local keyboard-focusable equation scrolling. Numeric story substitutions come from solver-recorded substitutions and retain the required specific-energy, specific-heat, and specific-volume units.

## Authority boundary

The finite recipe registry covers all 44 registered `derive` directions. The four `ideal_gas_n:Rs` directions remain validate-only. The story consumes each selected primary direction once, never changes formula expressions, values, solve directions, or policy, and returns unavailable if selected execution provenance is incomplete.

Joule alternatives are rendered as collapsed rows attached to their selected parent result. Legacy `StepDisplay` retains its behavior for non-Joule modules; it does not render a detached second alternative dialect for the complete Joule story.

## Evidence

- `tests/modules/joule/calculation-story.test.ts`: Golden hierarchy, entropy micro-step IDs, first-use/reuse rules, state markers, boxed payloads, units, telemetry removal, alternatives, and solver immutability.
- `tests/modules/joule/calculation-story-full.test.ts`: 44 derive / four validate-only registry reconciliation.
- `tests/components/calculation-story-display.test.tsx`: semantic grid, overview, collapsible tier, parent alternative, KaTeX rendering, and local scroll behavior.
