# Joule Human Reference — Phase 1 Checkpoint

## Scope and baseline

- Baseline head: `b4d85fa01ae5a595662f5a98d848ceef6b020758`
- Baseline tree: `af551bedf9958a95064e14885a7498e3b8e84696`
- Authoritative worktree: `/workspaces/ingenieursrechner-pr25-final-audit`
- Status: uncommitted and unpublished at checkpoint creation.

## RED evidence

Before production changes:

```text
npm test -- tests/components/calculation-story-display.test.tsx tests/components/app-calculation-story-focus.test.tsx
```

failed as intended because the renderer did not emit `data-story-row-id` for a synthetic supported row and App did not render the focus control. The focused tests were then made green after the bounded implementation.

## Implemented Phase 1 seam

- Added non-recursive `CalculationStorySupport` / `StorySupportRow` data types with stable ID, finite kind, title, disclosure state, and equation-grammar proof rows.
- Rendered support as a parent-row-attached semantic region with its own support-row grammar and responsive stacking.
- Added independent accessible `Main path only` state that hides attached support while retaining parent/main rows.
- Added App-owned focus presentation state keyed to the current module. Focus hides surrounding calculator presentation without replacing the Zustand store or recomputing the scenario, and restores focus to the control when leaving.

## Changed paths

- `src/core/calculation-story.ts`
- `src/components/CalculationStoryDisplay.tsx`
- `src/App.tsx`
- `src/index.css`
- `tests/components/calculation-story-display.test.tsx`
- `tests/components/app-calculation-story-focus.test.tsx`
- `docs/handoffs/2026-07-30-joule-human-reference-phase1-checkpoint.md`

## GREEN and verification

- Focus/support tests: 8 passed.
- Full suite: 39 files, 216 tests passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Changed paths and protected-object diff check against baseline: passed.
- Existing KaTeX Unicode warning output remains from pre-existing Joule rendering coverage; no test failure resulted.

## Publication

- Published head/tree/parent: pending; not published at checkpoint creation.

## Unresolved risks and next owner

- This is a seam-only Phase 1 change. It does not recompose Joule content into the Phase 2 seven-section 62-row story.
- No browser/integrated visual review has been performed here; Toka owns that exact-head gate after publication.
- Next owner: Toka.
- Phase 2 Joule recomposition was not started.

## Pre-publication revision

- Toka pre-push findings: R1 required German visible and accessible labels for the story controls; R2 required restoring readable baseline-style multi-line `App.tsx` JSX without changing Phase 1 behavior.
- Revision parent: `d7946dd1a08df3f5813acdf2e27fb3c30b8b71d1`.
- Revision paths: `src/App.tsx`, `src/components/CalculationStoryDisplay.tsx`, `tests/components/app-calculation-story-focus.test.tsx`, `tests/components/calculation-story-display.test.tsx`, and this checkpoint.
- Focused focus/support component tests: passed — 2 files, 8 tests.
- Full `npm test`: passed — 39 files, 216 tests. The existing KaTeX Unicode warnings remain non-failing.
- `npm run lint`: passed.
- `npm run build`: passed; Vite retained its non-failing >500 kB chunk-size warning.
- `git diff --check`: passed.
- Changed-path check from `d7946dd1a08df3f5813acdf2e27fb3c30b8b71d1` and protected-path check from baseline `b4d85fa01ae5a595662f5a98d848ceef6b020758`: pending final post-commit proof.
- Final unpublished head/tree/parent: recorded in the execution return after the single child commit; this checkpoint cannot truthfully embed its own commit object ID.
- Publication owner remains Toka; no publication or browser verification was attempted.
