# Joule Calculation Story

## Status

The Joule/Brayton module currently uses a reference-only Calculation Story adapter. It is not a second solver, a CAS, a route-selection mechanism, or a claim that arbitrary complete scenarios already have an approved full derivation.

## Reference-scope contract

The recipe registry is a reconciled 12-family inventory for future expansion; the current runtime authority is the exact approved reference-air preset. The inventory records:

- an exact `formulaId:targetId` identity;
- a governing formula entry point from the registered module formula;
- declared execution conditions inherited from its direction policy;
- a finite symbolic transformation role and accepted numeric `SolutionStep` evidence;
- optional shared proof-node identity for material, ideal-gas, and entropy relations.

Full Story activates only for normalized user inputs `T1=300 K`, `p1=100 kPa`, `pressureRatio=10`, `T3=1400 K`, `kappa=1.4`, and `Rs=287 J/(kg K)`, with no additional user inputs. Other scenarios return `not-applicable`; solver values, validation, planner policy, and the generic presentation remain unchanged.

## Chain IR and renderer

Rows carry `chainId`, `rowRole`, structured equation fields, and optional complete KaTeX operation markup. The renderer uses dedicated bridge / left subject / relation / right expression columns. A continuation row has no `lhsLatex`; its blank left cell is intentional semantic state, not CSS suppression. Subject changes use a visible bridge such as `\Longleftrightarrow`. Operations are KaTeX arrows such as `\xrightarrow{\text{substitute }c_p}`.

Each equation is a focusable local horizontal scroller. At mobile widths the equation grid keeps its mathematical width and scrolls inside the row instead of creating document-level overflow.

## Full reference behaviour

The current reference-air scenario consumes 22 selected primary directions exactly once and leaves zero primary legacy cards. The story adds supporting checks separately, including the cycle residual and the `s_4=s_3` isentropic check while preserving `entropy_abs_4:s4` as selected primary provenance.

Alternatives, contradictions, diagnostics, and blocked facts remain in their existing presentation surfaces. Carnot, Diesel, and Otto retain legacy `StepDisplay` behaviour unchanged.

## Coverage and verification

- `tests/modules/joule/calculation-story-full.test.ts`: live inventory reconciliation, all 44 inventory keys, four validate-only checks, exact reference composition, semantic continuation/check rows, and altered-scenario rejection.
- `tests/modules/joule/calculation-story.test.ts`: material chain, direct `cp` route, all four reverse-heat targets, GR-02/GR-03 alternate solver routes, entropy consequence rows, cycle-check semantics, provenance rejection, full-card removal, and solver immutability.
- `tests/components/calculation-story-display.test.tsx`: semantic DOM grid, KaTeX operations, keyboard-focusable local scrollers.
- `tests/components/app-metadata.test.tsx`: reference UI has a complete story and zero primary `.step-card` elements.

The high-severity dependency audit finding is pre-existing and unchanged; no dependency or lockfile change is part of this feature.

## Semantic-family authority

`calculation-story-recipes.ts` inventories 12 relation families, 44 derive directions, and four validate-only `Rs` checks. The current composer does not consume that inventory as generalized authority; it is constrained to the approved reference preset.

The approved reference journey renders seven visible sections: material properties; state 1; compression; heat input; expansion; energy path; and cycle balance/performance. Numeric continuation rows deliberately omit their left subject.
