# Landing subsystem

The landing is the public presentation layer. It may introduce the registered thermodynamics modules and show bounded, reference-backed evidence, but it must not become a second solver or calculator store. The stable calculator entry is `?view=calculator` (optionally with `module`); landing theme, navigation, detail, and motion state stay outside the calculator store.

## Read order

1. [Landing milestones](../../docs/frontend/MILESTONES.md) — durable product
   evolution and gate history.
2. [Engineering journey](../../docs/frontend/LANDING_ENGINEERING_JOURNEY.md) —
   why the current module and test boundaries exist.
3. [Architecture](../../docs/ARCHITECTURE.md#landing-and-calculator-boundary) — URL and solver boundary.
4. `landing-chapters.ts`, `LandingPage.tsx`, then the nearest chapter, model,
   motion, renderer, or test owner.

The [2026-08-01 design](../../docs/plans/2026-08-01-landing-page-design.md)
is historical context, not current authority.

## Entry and chapter map

`landing-chapters.ts` is the one production authority for chapter IDs, labels,
and order: `haltung → module → thermodynamik → rechenweg → projekt`.
`LandingPage`, `FloatingNavigation`, and deferred-section typing consume it.
`tests/landing/landing-page.test.tsx` deliberately keeps the literal expected ID
and navigation order independent; importing the production array into that
oracle would make an accidental reorder self-approve.

| Area | Entry / responsibility |
| --- | --- |
| Public boundary | `src/App.tsx` and `LandingPage.tsx` select landing or calculator from the URL. |
| Shell and navigation | `landing-chapters.ts`, `LandingPage.tsx`, `landing.css`, `FloatingNavigation.tsx`, and theme controls own presentation-only state. |
| Product chapters | `WrightHero.tsx`, `ModuleAtlas.tsx`, `ThermodynamicsExplorer.tsx`, `JouleProof.tsx`, and `ProjectCoda.tsx` compose the visible route. |
| Reference evidence | `model/landing-modules.ts`, `model/reference-scenario.ts`, `LandingDiagram.tsx`, and `model/joule-proof.ts` adapt existing module authority. |
| Background and line field | `background/` and `line-field/` own their renderer, configuration, and fallback boundaries. |
| Elastic module menu | `components/AnimatedContent*.tsx` and `motion/config/` own the accepted item motor and causal-chain lifecycle. |

## Protected contracts

- The module registry, diagrams, solver, and calculation-story interfaces remain the sole source for calculator facts; the landing only adapts them.
- Calculator navigation is CTA-only from the inline module detail. The four real registry modules and their order remain `Carnot`, `Otto`, `Diesel`, `Joule/Brayton`.
- Preserve the accepted Wavefield/background and the exact ReactBits `AnimatedContent` item motor; changes need an explicit, named delta and browser acceptance.
- Reduced Motion settles immediately while retaining meaningful interaction. Do not add hidden timers, remount-based replay, a second motion system, or landing state to the calculator store.
- Passing checks prove only their named behavior. They do not by themselves
  authorize push, merge, deployment, or publication.

## Integrity and observation

- Landing reference scenarios fail before solving when a preset names an unknown variable or cannot provide a complete four-state/four-edge T-s cycle. Legitimately dimensionless declared units remain `''`; the generic calculator schema stays permissive.
- Frame-count evidence is test-owned. Production does not publish or mutate a per-frame DOM attribute; unit tests count renderer calls and Playwright counts only WebGL draws from `.landing-line-field__renderer-host`.
- Scrollers resolve against the mounted owner document: omitted input uses its snap container or viewport, `null` explicitly means viewport, and valid elements/selectors preserve exact identity. Missing, blank, or malformed explicit selectors fail before any Chain or child motion resource; registered children cannot override their Chain's scroller.
- Exit focus rescue uses that same owner document before descendants become inert, including iframe/foreign-document mounts.
- Elastic-menu evidence is also test-owned. Production exposes only the public `data-elastic-menu-phase`; browser tests observe that phase and real wrapper-style mutations, while unit/integration tests inspect actual GSAP payloads and exact owned-resource cleanup. No query-gated Chain audit or diagnostic global ships in the deferred bundle.

### Renderer diagnostic contract

`render-failure.ts` defines one optional typed reporter for the `line-field` and
`background` boundaries. Reports retain the exact `Error` identity and name the
stage (`loading`, `initialization`, `motion-step`, `resize`, `render`, or
`disposal`). The reporter is observation-only: it may not throw through the
boundary, replace the visible fallback, add a diagnostic global, or cause a
second disposal attempt.

### Elastic Chain phase contract

| Event | Accepted transition |
| --- | --- |
| Enter | `initial -> entering -> settled`; an interrupted `reversing` resumes forward. |
| Leave back | `entering|settled -> reversing -> initial`, then the same trigger is rearmed. |
| Leave | `initial|entering|settled|reversing -> exiting -> exited`. |
| Enter back | `entering|reversing|exiting|exited -> settled`; stale work stays inert. |
| Refresh past the end | Any live normal phase becomes canonical `exited`. |
| Reduced Motion | Live motion resources stop and the chain becomes visible, interactive `reduced`. |

Same-phase and invalid-direction events are intentional no-ops. `onPhaseChange` reports changes only; it does not emit the initial phase. The item motor remains the exact ReactBits derivative—this table describes only Chain ownership around it.

## Configuration pipelines

These are the three owner-editable, fail-closed pipelines. Generated TypeScript is checked, not hand-edited.

| Pipeline | YAML and schema | Generated module | Compile / check |
| --- | --- | --- | --- |
| Line field | `line-field/config/line-field.animation.yaml`, `line-field/config/line-field.animation.schema.json`, `line-field/config/line-field.materials.yaml`, `line-field/config/line-field.materials.schema.json` | `line-field/config/line-field-config.generated.ts` | `npm run line-field:config` / `npm run line-field:config:check` |
| Landing background | `background/config/landing-background.effects.yaml`, `background/config/landing-background.effects.schema.json` | `background/config/landing-background-config.generated.ts` | `npm run landing-background:config` / `npm run landing-background:config:check` |
| Elastic menu chain | `motion/config/elastic-menu-chain.motion.yaml`, `motion/config/elastic-menu-chain.motion.schema.json` | `motion/config/elastic-menu-chain-config.generated.ts` | `npm run elastic-menu-chain:config` / `npm run elastic-menu-chain:config:check` |

`predev`, `pretest`, and `prebuild` run the relevant compilation or freshness checks. Use the explicit command when changing one pipeline so the generated diff can be reviewed with its YAML/schema source.

All three explicit watch commands own directory-level exact-basename watchers,
serialize dirty recompiles, publish through exclusively owned same-directory
temporary files and an atomic rename, preserve the last valid output, and drain
without a late publish on `SIGINT`/`SIGTERM`.

Every source `version` is a fail-closed YAML/schema gate, not a render control. Background and Elastic omit it from generated runtime objects; Line-field additionally exports its two versions as named authoring metadata because Session 3 evidence consumes them.

### Line-field config truth during cleanup

- Pixel/motion authority remains in the accepted material themes, scroll/autonomous phase, front/reveal start, motto/orbit, fallback stroke, and render-budget groups. Lifecycle-only controls `handoff.reverseDeadbandPx`, `pointer.radiusVw`, and `pointer.smoothingSeconds` are also real and must not be deleted as “nonvisual”.
- `staggeredTipCount: 36` owns exactly 36 deterministic stagger offsets; the accepted fixed renderer adds four implicit zero-offset endpoints and still draws 40 lines on desktop and mobile.
- The obsolete narrow-crop controls `projectedWidthVw` and `bleedPaddingPx` are retired. The field already owns the full viewport; old authoring is rejected by the schema.
- The currently audited no-effect set is retired: fixed direction/rotation declarations, the legacy amplitude envelope, completion overshoot, mobile lane selection, degree-based pointer twist, and runtime revision residue. The real normalized pointer radius/smoothing lifecycle remains supported; both source-document versions remain independent fail-closed authoring metadata rather than render controls.

## Verification routes

- Focused/unit: `npm run test:unit`; narrow further with `npm run test:unit -- <test-path>` when the project selection supports the target.
- Process ownership: `npm run test:process-gates`. This serial project owns the
  HMR gate, Playwright server-ownership gate, all three config compiler/watch
  suites, and the Session 3 evidence finalizer; `vitest.config.ts` is the exact
  six-file authority.
- Full sequence: `npm test` runs config freshness first, then `test:unit`, then `test:process-gates` sequentially.
- Browser: `npm run test:e2e` builds first, then Playwright alone owns
  `127.0.0.1:4173` with `--strictPort`, `reuseExistingServer: false`, one worker,
  and bounded shutdown. The visual journeys intentionally serialize because
  they share browser animation/WebGL timing. Do not pre-start or reuse a preview
  server. Inspect desktop and 390 × 844 behavior, keyboard flow, Reduced Motion,
  and the reference-air journey.
- Comparator negative controls and real-source mutation are different evidence.
  The former alter captured clones; the latter changes one real source in a
  fresh isolated copy and requires the unchanged owning test to RED for the
  intended reason. No one-command mutation gate exists; use the tracked
  [manual isolated-copy route](../../docs/TESTING.md#manual-landing-real-source-mutation-gate).
