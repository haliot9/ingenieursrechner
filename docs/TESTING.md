# Testing and Verification Doctrine

## Purpose

Tests provide evidence that the calculator is physically valid, deterministic, explainable, and safe to change. A green suite is not proof by itself: every test must protect a requirement, invariant, regression, or user-visible contract.

## Change workflow

For every behavioral change:

1. Identify the affected boundary: formula, solver, validation, units, store, component, diagram, build, or deployment.
2. State the smallest observable requirement and the important failure mode.
3. Add or identify a test that fails for the intended reason.
4. Confirm that failure before changing production code.
5. Implement the smallest coherent correction.
6. Run the targeted test, then the complete verification bundle.
7. Use a real browser when user-visible behavior changed.
8. Report executed evidence and anything left unverified.

A defect is not verified as fixed unless its regression test failed against the defective behavior and passed after the correction.

## Choose the lowest useful test layer

| Layer | Proves |
|---|---|
| Formula | Every supported `solveFor` direction against independently calculated values |
| Solver/core | Chaining, termination, determinism, contradictions, insufficient data, constraints, and calculation steps |
| Property-based | Physical and mathematical invariants over meaningful generated states |
| Store/boundary | SI conversion, display-unit isolation, reset behavior, and module integration |
| Component | User-visible interaction and rendering contracts, not private React state |
| End-to-end | Critical journeys that require a real browser |

Do not replace a smaller deterministic test with a browser test when the smaller test proves the same requirement.

## Thermodynamic risk coverage

A calculation-logic change must consider the relevant items below:

- every supported rearrangement of the changed relation;
- minimum, maximum, near-zero, prohibited-zero, and non-finite values;
- sign conventions and reversed or degenerate cycles;
- redundant consistent and redundant contradictory inputs;
- canonical SI values versus display units;
- deterministic output independent of formula registration order;
- preservation of inspectable calculation steps.

Use risk to select cases. Do not inflate the suite with combinations that prove nothing new.

## Expected values and numerical tolerances

Expected values must not be produced by the same production function under test.

Critical relations need at least one anchor from:

- a hand-calculated reference;
- a cited textbook or standard;
- an independently implemented oracle;
- an invariant that must hold independently of implementation.

Golden-state helpers may cover broad input combinations, but must remain anchored by independent reference cases.

Approximate assertions need a justified tolerance:

- prefer relative error for scale-dependent values;
- prefer absolute error near zero;
- do not loosen tolerances merely to make a test pass;
- document changes caused by floating-point propagation, conditioning, display rounding, or changed precision requirements.

## Property-based tests

Property tests express invariants rather than replaying examples with random numbers. Useful Carnot properties include:

- `0 < eta < 1` and `T_hot > T_cold`;
- `q_in > 0`, `q_out < 0`, and `w_netto < 0`;
- `w_netto = -(q_in + q_out)`;
- equivalent valid input sets converge to the same solved state;
- display-unit changes do not alter canonical SI values.

Generate physically meaningful states and minimize rejected cases. Preserve the failing seed and shrink path until the defect is understood.

## Regression policy

Every confirmed, automatable defect receives a regression test that:

- reproduces the smallest domain-level or user-visible failure;
- fails against the defective behavior;
- passes after the correction;
- remains in the suite;
- references the issue or failure-history entry when one exists.

Tests or assertions may be deleted or weakened only when the associated requirement intentionally changed and that change is documented.

## Assertion quality

Prefer assertions about numerical results, physical invariants, typed errors, contradiction reports, public interfaces, and user-visible behavior.

Avoid relying on:

- private component state or incidental DOM structure;
- implementation order unless it is part of the contract;
- snapshots as proof of mathematical correctness;
- only the absence of an exception;
- mocks that replace the behavior being tested.

## Browser verification

For relevant UI, responsive-layout, diagram, or formatting changes, inspect:

- a desktop viewport;
- a 390 × 844 mobile viewport;
- the reference-air journey;
- browser console errors and visible overflow;
- keyboard interaction and meaningful error presentation when affected.

Critical journeys should be automated with Playwright. Screenshots supplement automated assertions; they do not replace them.

## Required verification

Run the narrowest relevant test first:

```bash
npm test -- <test-path>
```

Then run the complete local gate:

```bash
npm run verify
```

The gate comprises tests, lint, production build, and `npm audit --audit-level=high`.

## Evidence report

A completed task reports:

- requirement or defect protected;
- tests added or changed;
- exact commands executed and results;
- skipped, quarantined, blocked, or unverified checks;
- browser viewport and journey when applicable;
- remaining risks or assumptions.

Never report “all tests pass” when only targeted tests were executed.

## Prohibited behavior

Agents and contributors must not:

- weaken assertions or increase tolerances merely to obtain green output;
- delete tests without a documented requirement change;
- repeatedly rerun a flaky test until it happens to pass;
- hide skipped tests or silently update snapshots;
- mock the behavior the test is intended to prove;
- change a defect and its regression test without demonstrating the original failure;
- claim release readiness while a required check is failing or unexecuted.

## Release gate

A change is release-ready only when required regressions exist, the complete verification bundle passes, critical browser journeys are verified where applicable, documentation reflects changed behavior, and remaining uncertainty is explicit.
