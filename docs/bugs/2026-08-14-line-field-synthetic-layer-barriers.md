# Bug: synthetic Wavefield boundaries look like landing-page layer seams

Status: **FIXED — technically verified and owner visually accepted on 2026-08-14**

The local before/after browser evidence was intentionally excluded from the
public source tree. The regression contract below is executable in the tracked
unit and browser tests.

## Visible symptom

After the field opens, perfectly straight horizontal and lateral boundaries cut through the animated lines. The boundaries remain aligned to the viewport/slide composition while the wave moves, destroying the illusion of one continuous band. The defect is especially obvious in dark mode above and below the motto card and persists across lower landing sections.

The motto card itself is correctly painted in front of the field. The first repair removed the narrow canvas boundary, but owner review exposed a remaining perfectly horizontal upper cutoff inside the viewport-sized canvas.

## Reproduction

1. Open the landing page in dark mode with normal motion.
2. Scroll through the Wright film until the motto card and opened 40-line field are visible.
3. Stop with the card near the center of the viewport.
4. Observe the field above and below the card.
5. Continue into lower sections and repeat after an up-scroll/down-scroll cycle.

Expected:

- the field is one continuous transparent-background effect;
- only actual foreground objects such as the video, cards, header, buttons, and menu occlude it;
- no slide boundary, internal canvas edge, or helper mask is visible.

Actual after the first viewport-stage repair:

- the lateral canvas boundary is gone;
- all strands are still hard-zeroed on the same horizontal shader row;
- field exposure starts at film progress `0.88`, after the Wright clip already starts fading at `0.80`;
- the horizontal guillotine follows the reveal/reverse state and reappears across sections.

## Root cause evidence

### A. Synthetic vertical occlusion boundary

`LandingLineField.css` applies a top-to-bottom mask to `.landing-line-field__renderer-host`. It is fully transparent through `--line-field-occlusion-start-y` and becomes visible at `--line-field-occlusion-end-y`.

`LandingLineField.tsx` derives those values from `stickyBottomViewportY` on every rendered frame. The configured transition is only 18 px, so it appears as a hard horizontal cut. This duplicates occlusion already supplied by the actual stacking order: sticky video `z-index: 1` above field `z-index: 0`.

### B. Narrow field root clips geometry wider than its box

The root width is:

```text
viewportWidth * projectedWidthVw / 100 + 2 * bleedPaddingPx
```

With the owner screenshot dimensions and current config:

```text
1706 * 0.10 + 2 * 24 = 218.6 px
```

The renderer's lateral source scale is independently derived from viewport height:

```text
sourceLengthPx * 9 / 12 = 1140 * 0.75 = 855 px
```

The accepted source function can move its centerline by roughly one quarter of that lateral scale, about 214 px per side, before line softness/glow. The origin sits only 24 px from the root's left edge. `overflow: hidden` plus the 24 px horizontal mask must therefore clip live geometry.

### C. Page stacking is already sufficient for the foreground objects

Current relevant paint order is:

```text
navigation 70/60
header 50
lower content/cards 3
motto 2
sticky video 1
wavefield 0
page background
```

The page has one opaque `.landing-shell` background. Lower sections themselves have no opaque slide background. This rules out a separate background plane per section as the source of the reported straight cuts.

### D. Remaining shared shader guillotine

The current fragment shader computes two branch-wide binary masks:

```glsl
float lowerVisible = step(physicalOriginLocalPx.y, cssPoint.y)
  * step(cssPoint.y, physicalFrontLocalY);
float upperVisible = step(upperPhysicalFrontLocalY, cssPoint.y)
  * step(cssPoint.y, physicalOriginLocalPx.y);
```

Every strand crosses the same exact `physicalOriginLocalPx.y` and `physicalFrontLocalY` thresholds. `step()` therefore changes all strand alpha from zero to visible on one screen row. This is the remaining straight upper edge in the owner screenshot; it is not a DOM stacking boundary.

### E. Reveal is temporally late relative to the clip fade

The Wright clip fade starts at `WRIGHT_TIMELINE.themeFadeStart = 0.80`. The line-field asset currently waits until `reveal.startFilmProgress = 0.88`. That gap makes the field appear as a later slide event instead of emerging while the clip fades.

### F. Confirmed remaining DOM occluder after the shader repair

The first real-browser screenshot after replacing the shared shader front still showed an edge. A live paint-stack measurement at scroll `2180` located it exactly:

```text
.wright-film-track bottom: 420 px
.wright-hero-sticky bottom: 420 px
visible field begins: 420 px
```

Above that row, `.wright-hero-sticky` is an opaque parchment rectangle and its `::after` pseudo-element is an opaque `var(--landing-bg)` rectangle at opacity `1`. Both paint above the field. The pseudo-element hides the clip by painting a new background plane; it cannot reveal the field underneath. This is the actual film-to-motto seam still visible after the viewport-stage repair.

## First hypothesis tested

Replace the narrow masked field root with one viewport-sized transparent render stage, place the unchanged shader origin at the real viewport anchor, and remove the film-bound vertical field mask. Do not change field math, motion state, material, card/video stacking, or reverse behavior.

Result: this removed the lateral crop and DOM/CSS mask but did not remove the shader's own binary horizontal masks.

## Reopened hypothesis and authorised repair

- Align initial field exposure with the existing Wright clip-fade start (`0.80`).
- Remove the shared `step()` front/origin guillotine from strand alpha.
- Keep the accepted centerline/Perlin function, phase, 40 lanes, material, depth cue, stacking, and state-machine ownership unchanged.
- Let the same transparent viewport field remain continuous across film, motto, and all lower slides; only real foreground objects occlude it.
- Make the sticky film carrier transparent and fade the video pixels themselves with `--wright-theme-fade`; do not replace them with an opaque pseudo-background plane.

## Implemented fix

- `.landing-line-field` now covers `inset: 0`, `100vw`, and `100vh` without edge masks or an internal overflow crop.
- `measureScene()` now sizes the root/canvas to the viewport and places its left edge at `0`.
- the renderer and Reduced Motion fallback use `frame.anchorViewport[0]` as the local origin X;
- all `stickyBottomViewportY`, `data-line-field-occlusion`, and occlusion CSS-variable behavior was removed;
- `reveal.startFilmProgress` now equals the clip-fade start at `0.80`;
- each thread receives its deterministic physical endpoint, replacing the shared branch-wide shader cutoff;
- `.wright-hero-sticky` and its removed pseudo-plane no longer paint an opaque rectangle; `.wright-hero-media` itself fades to transparency;
- the accepted 40-line centerline/Perlin function, phase clock, theme materials, and reverse state machine were left unchanged.

Files in this fix:

- `src/landing/line-field/LandingLineField.css`
- `src/landing/line-field/LandingLineField.tsx`
- `src/landing/line-field/renderer/LandingLineRenderer.ts`
- `src/landing/line-field/renderer/line-field-shaders.ts`
- `src/landing/components/WrightHero.css`
- `src/landing/line-field/config/line-field.animation.yaml`
- focused unit/integration and browser assertions in the corresponding test files.

## Required regression evidence

- RED against the current implementation: field/canvas is not viewport-sized and computed masks are present.
- GREEN after the minimal change: root and canvas cover the viewport, computed root/host masks are `none`, and the source origin still equals the measured video anchor.
- Real browser journey: video/card remain in front; fixed-scroll autonomous pixels advance; full reverse opacity reaches `0`; downward re-entry restores `1` on the same canvas.
- Owner screenshot/browser review remains the final visual gate.

## Final verification recorded 2026-08-14

- RED: actual config returned `0.88`; shader still contained shared `lowerVisible`/`upperVisible`; renderer had no per-line physical endpoints.
- Focused GREEN: 29/29 affected config/renderer tests passed.
- Full tests: 68 files and 464 tests passed.
- Generated config check, scoped ESLint, `npm run build`, and initial-bundle check passed.
- Browser measurement before CSS repair: film/sticky bottom and visible cutoff were all exactly `420 px`; sticky plus pseudo background were opaque.
- Browser measurement after repair: sticky and pseudo backgrounds are transparent, media opacity follows the clip fade, and no boundary remains at the film bottom.
- Manual desktop/mobile Down -> Up -> Down: `autonomous -> reverse-gather -> autonomous`, increasing frame sequence, same retained canvas.
- Updated production journey: mobile passed at the standard timeout; desktop passed with `--timeout=45000` in 35.9 seconds. The default 30-second desktop run reached late lifecycle verification but exhausted the suite timeout.
- Fresh pre-commit verification: 68/68 test files and 464/464 tests, full ESLint, generated config, production build, and bundle check passed. `npm run verify` still exits non-zero at the unchanged dependency audit because the existing tree contains a high `nanoid` advisory and a moderate `postcss` advisory; no dependency manifest or lockfile is part of this fix.
- Fresh full landing browser suite at a 45-second per-test budget: 26 passed and 8 evidence-only cases skipped across desktop and mobile Chromium; no failures.
- Local screenshots were reviewed during acceptance but are not release source.

## Owner acceptance

On 2026-08-14 the owner confirmed that the continuous field now has no unwanted hard transition or edge and explicitly accepted the result. This closes the product/visual gate for the no-cuts and clip-fade behavior. The same message authorised documentation and one local commit; it did not authorise push, PR, merge, deployment, or additional polish.

The earlier classification of the moving reveal front as intentional was rejected by the owner and is withdrawn. A perfectly straight shared cutoff is a bug whether it comes from CSS, canvas bounds, or shader state.

## Explicitly out of scope

- changing the accepted 40-line wave geometry;
- endpoint/globe polish;
- reordering unrelated landing content;
- general component or configuration refactoring;
- push, PR, merge, or deployment.
