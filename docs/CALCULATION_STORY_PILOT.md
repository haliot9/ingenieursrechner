# Joule Calculation Story

The general quantity/direction/proof architecture is defined in [DERIVATION_ARCHITECTURE.md](DERIVATION_ARCHITECTURE.md). This document records only the current Joule-specific reference-story authority and evidence.

## Status

The Joule/Brayton module currently uses a reference-only Calculation Story adapter. It is not a second solver, a CAS, a route-selection mechanism, or a claim that arbitrary complete scenarios already have an approved full derivation.

## Reference-scope contract

The recipe registry is a manually reviewed 12-family inventory for future expansion; the current runtime authority is the exact approved reference-air preset. The inventory records:

- an exact `formulaId:targetId` identity;
- a family-owned entry-point equation and condition notes;
- a target section and finite set of permitted transformation kinds.

Tests currently reconcile only its direction-ID keys against the 44 active derive directions. Entry-point equations, conditions, transformations, and individual `SolutionStep` provenance are not derived from or fully reconciled with formula/policy metadata. That stronger recipe/provenance contract is Phase A work.

Full Story activates only for normalized user inputs `T1=300 K`, `p1=100 kPa`, `pressureRatio=10`, `T3=1400 K`, `kappa=1.4`, and `Rs=287 J/(kg K)`, with no additional user inputs. Other scenarios return `not-applicable`; solver values, validation, planner policy, and the generic presentation remain unchanged.

## Chain IR and renderer

Rows carry `chainId`, `rowRole`, structured equation fields, and optional typed KaTeX operation markup. The renderer uses dedicated operation, left-subject, relation, right-expression, and support columns. A continuation or numeric row has no `lhsLatex`; its blank left cell is intentional semantic state, not CSS suppression. Equivalent subject changes use an explicit operation arrow such as `\xleftrightarrow{\text{solve for }c_p}`; substitutions use arrows such as `\xrightarrow{\text{substitute }c_p}`.

Each equation is a focusable local horizontal scroller. At mobile widths the equation grid keeps its mathematical width and scrolls inside the row instead of creating document-level overflow.

## Full reference behaviour

The current reference-air scenario mirrors all 22 selected primary direction identities in `consumedSteps` and displays zero legacy cards. Its 62 main rows include a cycle-check row with attached energy, entropy, and efficiency support. The composer builds those rows from the final values and frozen reference recipe; it does not yet prove one-to-one row consumption from individual `SolutionStep` records.

Current limitation: whenever a complete or unavailable Story is displayed, the calculator page suppresses the generic `StepDisplay`, including alternatives, contradictions, diagnostics, blocked facts, or any unconsumed primary steps. A `not-applicable` result does preserve generic evidence. Carnot, Diesel, and Otto retain legacy `StepDisplay` behaviour unchanged. Phase A must add truthful residual-evidence coexistence before partial free-input stories activate.

## Coverage and verification

- `tests/modules/joule/calculation-story-full.test.ts`: 48-direction inventory reconciliation, 44 recipe keys, four validate-only checks, frozen seven-section / 62-row / 26-support composition, fact-state grammar, live final values, and altered-scenario rejection.
- `tests/modules/joule/calculation-story.test.ts`: selected-direction mirroring, target-local support, the single initially collapsed unit detail, and unavailable fallback for a missing accepted prerequisite.
- `tests/components/calculation-story-display.test.tsx`: semantic DOM grid, disclosure controls, main-path filtering, KaTeX, continuation semantics, keyboard-focusable local scrollers, and unavailable rendering.
- `tests/components/app-calculation-story-focus.test.tsx`: permanent full-width placement and result stability while rendering.
- `tests/components/app-metadata.test.tsx`: exact reference UI has a complete story, 22 consumed direction identities, and zero `.step-card` elements.

## Semantic-family authority

`calculation-story-recipes.ts` inventories 12 relation families, 44 derive directions, and four validate-only `Rs` checks. The current composer does not consume that inventory as generalized authority; it is constrained to the approved reference preset.

The approved reference journey renders seven visible sections: material properties; state 1; compression; heat input; expansion; energy path; and cycle balance/performance. Numeric continuation rows deliberately omit their left subject.
