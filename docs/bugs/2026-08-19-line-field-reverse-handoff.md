# Bug: reverse gather followed the deepest scroll and stalled without more scrolling

Status: **FIXED — technically verified and owner visually accepted on 2026-08-19**

## Visible contract

After the 40-line field finishes its scroll build, it hands off once and continues autonomously. Scrolling upward while still above the original build/handoff boundary must not interrupt that motion. Only after the page crosses below that boundary should the field gather back toward its reverse scroll-built form. That gather must visibly finish in `0.45 s` even if the owner stops scrolling, and the resulting field must be the same state the normal scroll-build path would produce at that position.

The complete journey must keep the accepted renderer, shader, 40-line centerline/Perlin character, theme material, stacking, production WebGL context, root, and canvas intact.

## Why the prior reverse behavior failed

### 1. The deepest position was mistaken for the handoff boundary

The old `forwardScrollWatermark` continually stored the deepest page position reached after handoff. Reverse started after moving upward by a small deadband from that moving watermark. A small upward gesture far below the original handoff could therefore start gather too early, even though the field should still have been autonomous.

The accepted behavior has one stable semantic boundary: `handoffScrollY` is frozen to canonical `metrics.buildEndScrollY` when handoff begins. An overshooting browser sample cannot move it deeper. Upward motion above `handoffScrollY - reverseDeadbandPx` remains analytic `auto-handoff`/`autonomous` motion.

### 2. Gather distance was scroll-driven, so fixed scroll meant frozen pixels

The old gather ratio was derived from extra upward distance after reverse capture. If scrolling stopped, the ratio stopped too. The field could remain half gathered indefinitely, which looked like a frozen or disappeared animation.

The corrected `reverse-gather` advances `motionElapsedSeconds` on animation frames and uses the existing `velocityBlendSeconds = 0.45` as its sole duration authority. It continues requesting frames through trigger, midpoint, and completion, so no additional wheel or touch input is required. The obsolete distance and fixed phase-cycle controls were removed.

### 3. The old destination was an approximation, not scroll-build truth

The prior branch independently mixed the autonomous capture toward the origin, zero offsets, zero opacity, and a configured backward phase. It did not hand control to `scroll-build` at completion. That duplicated the scroll-build law and allowed the two paths to disagree.

The corrected branch obtains its destination from canonical `scrollBuildSnapshot(...)` at the current scroll geometry. It interpolates every public motion channel from the exact live capture toward that snapshot, with target velocities settled to zero. At progress `1`, the state changes to `scroll-build` and stores the same canonical sample, so the final reverse frame and the next ordinary scroll frame share one authority.

### 4. Absolute phase rewinding produced long-run discontinuities

After a long autonomous run, forcing phase backward by a fixed number of cycles would either rewind rapidly or leave a visible phase-position jump at completion.

At reverse capture, the corrected state predicts the phase reached after a `0.45 s` smooth deceleration and computes `scrollPhaseOffsetRadians` against the canonical scroll phase at the current build progress. Gather then decelerates phase forward into that rebased target. The subsequent `scrollBuildSnapshot(...)` uses the same offset, so completion has no terminal phase snap while reverse scrolling can continue normally.

### 5. Any downward nudge aborted the old gather

The old branch restarted `auto-handoff` on any downward change relative to the previous sample. Trackpad jitter or a deliberate direction correction below the real boundary could therefore interrupt gather and oscillate modes.

The corrected gather ignores direction changes that remain below the frozen boundary and continues on elapsed time. If the page actually crosses back to `handoffScrollY`, it captures the exact current gather snapshot and starts one new analytic handoff from that state. If gather has already completed, normal `scroll-build` owns the route until the canonical boundary is crossed again.

## Accepted implementation contract

The state transitions are now:

```text
scroll-build
  -> auto-handoff
  -> autonomous
  -> reverse-gather only below frozen handoffScrollY - deadband
  -> canonical scroll-build after 0.45 s
```

During `reverse-gather`, crossing back to `handoffScrollY` takes the exact current snapshot into one `auto-handoff`; changes of direction below it do not.

This repair is deliberately motion-state-only. No production renderer or shader file was changed. The accepted 40 lanes, centerline/Perlin geometry, line material and layering, discardable production backbuffer, and one-canvas lifecycle remain the baseline. Browser regression evidence tags the original root and canvas and verifies that both survive reverse completion and forward re-entry.

## Verification recorded for the accepted tree

- Focused state/component/config/finalizer bundle: 4 files, 106/106 passed.
- Full Vitest suite: 68 files, 468/468 passed.
- ESLint, generated-config freshness, TypeScript, Vite production build, initial-bundle budget, and `git diff --check` passed.
- Real Chromium production journeys: desktop 1440x900 and mobile 390x844, 4/4 passed under the normal Playwright command.
- Browser assertions cover autonomy while scrolling upward above the boundary; reverse only below it; visible pixel change at fixed scroll from trigger to 50% to 100%; canonical `scroll-build` completion at unchanged scroll; one root/canvas; forward re-entry; native magnetic coexistence; and route cleanup.
- Deterministic pixel evidence uses a test-only readable backbuffer and decoded RGBA comparison. A separate journey leaves production WebGL and native magnetic behavior intact.
- The production audit remains red only for the pre-existing `nanoid` high and `postcss` moderate advisories. No dependency manifest or lockfile changed in this slice.

## Owner acceptance and remaining authority

On 2026-08-19 the corrected reverse behavior was visually accepted. This
closes the product/visual gate for the boundary, autonomous-upward, fixed-scroll
gather, canonical reconnection, and re-entry journey described above.

The next bounded visual slice is endpoint teardrop/comet polish. It must begin from this exact accepted field and reverse baseline and receive its own owner-visible acceptance. Endpoint work must not reopen the 40-line geometry or reverse lifecycle by accident.

Visual acceptance does not authorise a commit, push, PR, merge, deploy, publication, broad refactor, dependency change, or evidence cleanup. Those remain separate explicit gates.

## Retrieval pointers

- `src/landing/README.md` — current subsystem map and protected contracts.
- `src/landing/line-field/motion/line-field-state-machine.ts` — boundary, gather, phase rebase, and re-entry authority.
- `src/landing/line-field/config/line-field.animation.yaml` — `velocityBlendSeconds` and reverse deadband.
- `tests/landing/line-field-state-machine.test.ts` — deterministic transition regressions.
- `tests/landing/landing-line-field.test.tsx` — controller RAF and same-canvas behavior.
- `e2e/landing-journeys.spec.ts` — desktop/mobile production journeys and visual evidence seam.
- `docs/bugs/2026-08-14-line-field-synthetic-layer-barriers.md` — separately accepted no-cuts/compositing history.
