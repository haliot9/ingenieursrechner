# Joule / Brayton module

Static deterministic educational model of the ideal four-state Joule/Brayton heat-engine cycle.

## Topology and signs

1->2 is isentropic compression, 2->3 is isobaric heat input, 3->4 is isentropic expansion, and 4->1 is isobaric heat rejection. The repository convention is preserved: `q_in > 0`, `q_out < 0`, `w_comp > 0`, `w_turb < 0`, and `w_netto < 0`.

## Full calculation-story contract

The module owns a finite recipe registry for all 44 registered `derive` directions. The four `ideal_gas_n:Rs` directions remain validate-only checks; they never become material-property derivations. A recipe is keyed by exact `formulaId:targetId`, names an approved formula-registry entry point, retains declared conditions, and emits semantic chain rows from accepted `SolutionStep` provenance.

The composer consumes every selected primary direction exactly once. Missing recipe or execution evidence produces explicit `unavailable` output without changing solver values. Shared ideal-gas, entropy-datum, and material relations have stable proof-node identities; checks such as the cycle residual remain separate from the primary spine.

## Presentation boundary

`CalculationStoryDisplay` receives chain semantics (`rowRole`, operation KaTeX, bridge/left/relation/right equation fields), not string-comparison hints. Unchanged left subjects are omitted only on explicit continuation rows. Every equation has a keyboard-focusable local horizontal scroller; the page itself remains constrained at mobile width.

The story consumes all primary Joule cards on a complete reference route. Legacy `StepDisplay` remains unchanged for Carnot, Diesel, Otto, alternatives, blocked relations, and contradictions.

## Assumptions and non-goals

Ideal gas with constant Rs, cp, cv, and kappa. The module validates the heat-engine domain. It does not implement dynamic stages, intercooling, reheat, recuperation, losses, variable heat capacities, runtime symbolic algebra, LLM generation, optimiser behaviour, or solver/direction-policy changes.

## Evidence

`tests/modules/joule/calculation-story-full.test.ts` reconciles the live 48-direction inventory (44 derive, four validate-only) and reference consumption. `tests/modules/joule/calculation-story.test.ts` covers provenance rejection, semantic material chains, and atomic full-story filtering. `tests/components/calculation-story-display.test.tsx` covers the semantic DOM grid, KaTeX operation rendering, and local scroller contract.

## Semantic-family authority

The current story is governed by exactly 12 module-owned families: material properties, ideal-gas state, relative entropy, pressure ratio, isobaric pressure, isentropic temperature, isentropic entropy, component work, net work, isobaric heat, ideal efficiency, and performance ratios. Their direction lists, governing entry points, conditions, process placement, and transformation shapes are explicit in `calculation-story-recipes.ts`. The live `solveFor` inventory is used only by tests to reconcile 48 registered directions into 44 derive directions and four validate-only `Rs` checks; it never auto-authorizes a new story.

The reference journey groups rows into eight Golden sections: Material properties; Reusable thermodynamic relations; State 1; compression; heat input; expansion; heat rejection; and cycle balance/performance. Numeric continuation rows deliberately omit their left subject.
