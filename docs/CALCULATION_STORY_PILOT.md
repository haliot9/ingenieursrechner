# Joule Calculation Story

## Status

The Joule/Brayton module uses a full finite calculation-story composer. This supersedes the former material-property pilot. It is a presentation adapter over selected solver provenance; it is not a second solver, a CAS, or a route-selection mechanism.

## Recipe contract

The recipe registry is generated from the live Joule formula inventory and explicitly excludes only the four validate-only `ideal_gas_n:Rs` checks. Each derive direction has:

- an exact `formulaId:targetId` identity;
- a governing formula entry point from the registered module formula;
- declared execution conditions inherited from its direction policy;
- a finite symbolic transformation role and accepted numeric `SolutionStep` evidence;
- optional shared proof-node identity for material, ideal-gas, and entropy relations.

If a selected direction is missing a recipe or an executed solver step, the adapter returns `unavailable`. Accepted numerical values, selected directions, validation, and planner policy are never mutated.

## Chain IR and renderer

Rows carry `chainId`, `rowRole`, structured equation fields, and optional complete KaTeX operation markup. The renderer uses dedicated bridge / left subject / relation / right expression columns. A continuation row has no `lhsLatex`; its blank left cell is intentional semantic state, not CSS suppression. Subject changes use a visible bridge such as `\Longleftrightarrow`. Operations are KaTeX arrows such as `\xrightarrow{\text{substitute }c_p}`.

Each equation is a focusable local horizontal scroller. At mobile widths the equation grid keeps its mathematical width and scrolls inside the row instead of creating document-level overflow.

## Full reference behaviour

The current reference-air scenario consumes 22 selected primary directions exactly once and leaves zero primary legacy cards. The story adds supporting checks separately, including the cycle residual and the `s_4=s_3` isentropic check while preserving `entropy_abs_4:s4` as selected primary provenance.

Alternatives, contradictions, diagnostics, and blocked facts remain in their existing presentation surfaces. Carnot, Diesel, and Otto retain legacy `StepDisplay` behaviour unchanged.

## Coverage and verification

- `tests/modules/joule/calculation-story-full.test.ts`: live inventory reconciliation, all 44 recipe keys, four validate-only checks, 22/22 reference consumption, semantic continuation/check rows.
- `tests/modules/joule/calculation-story.test.ts`: material chain, direct cp route, provenance failure, full-card removal, no solver mutation.
- `tests/components/calculation-story-display.test.tsx`: semantic DOM grid, KaTeX operations, keyboard-focusable local scrollers.
- `tests/components/app-metadata.test.tsx`: reference UI has a complete story and zero primary `.step-card` elements.

The high-severity dependency audit finding is pre-existing and unchanged; no dependency or lockfile change is part of this feature.
