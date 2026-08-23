# Landing engineering journey

This document records why the Landing subsystem has its current boundaries and
test architecture. It is deliberately about reusable engineering lessons, not
local agent sessions, private review telemetry, or release authorization.

## Outcome

The public root is a cinematic but deterministic presentation layer for the
existing calculator. Its accepted experience combines:

- a scroll-controlled Wright Flyer prologue;
- one continuous 40-line field derived from ReactBits `Threads`;
- theme-specific background and endpoint materials;
- a causal, reversible Thermodynamics menu derived from ReactBits
  `AnimatedContent`;
- authentic registry-backed module detail and T-s geometry;
- a stable URL boundary into the existing calculator.

The Landing does not own formulas, solver state, module availability, or a
second calculator store. Those facts stay in the existing calculator modules
and typed adapters.

## How the implementation evolved

### 1. Visual prototype before stable behavioral contracts

The first Landing prototype established composition, typography, media, theme,
and chapter intent. It was useful for visual direction, but several behaviors
were still implicit: which layer owns the continuous field, where scroll control
hands off to autonomous time, how reverse re-entry works, and whether a menu row
routes immediately or opens detail first.

The expensive mistake was not a lack of implementation ability. It was solving
robustness and lifecycle questions before the smallest owner-visible behavior
and its transition boundaries had been stated precisely.

### 2. Accepted visual assets became protected bases

Once the field geometry and motion were accepted, later work stopped treating
them as loose inspiration. The governing rule became:

```text
derivative = exact accepted base + explicitly named delta
```

This prevented endpoint materials, page layering, reverse behavior, or menu work
from silently reinterpreting the 40-line centerline and Perlin character.

### 3. Straight seams were traced to several different owners

The visible field cuts were not one generic “z-index bug.” Independent causes
included a narrow canvas, a CSS mask, shared shader cutoffs, a late reveal
threshold, and an opaque sticky-video plane. Treating every straight edge as the
same defect produced incomplete repairs.

The successful correction assigned one owner to each boundary:

- the field owns one transparent viewport-sized render surface;
- actual foreground content owns occlusion through normal stacking;
- each strand owns its endpoint rather than sharing one shader guillotine;
- the field begins exposing while the Wright clip itself fades.

The accepted field now persists across page chapters; sections do not crop it.

### 4. Reverse motion became an explicit state machine

The first reverse implementation tied gathering to the deepest scroll position
and to continued wheel movement. It could therefore start too early, freeze
when scrolling stopped, and reconnect to an approximation rather than the
canonical scroll-built state.

The repaired lifecycle uses one frozen handoff boundary and separates the
drivers:

```text
scroll-build -> auto-handoff -> autonomous
             -> reverse-gather -> canonical scroll-build
```

Autonomous motion remains time-driven above the boundary. Crossing below it
starts a time-driven gather that finishes without further scrolling. Its target
is produced by the same scroll-build law that owns ordinary reverse scrolling.

### 5. The menu reused the upstream item motor and added only missing ownership

The individual entry/disappearance motor stays an application-scoped adaptation
of ReactBits `AnimatedContent`. Product code adds the behavior the single-item
source does not provide: five-item registration, causal staggering, shared
trigger ownership, autonomous reverse order, rearm/replay, Reduced Motion, and
stale-completion guards.

The implementation deliberately remains a small set of cohesive modules:

- `AnimatedContent.tsx` binds one element to its exact item motor;
- `AnimatedContentRuntime.ts` owns controller and scroller contracts;
- `AnimatedContentChain.tsx` owns registration, phase, resources, and events;
- `animated-content-chain-schedule.ts` contains only pure schedule calculations;
- `ThermodynamicsExplorer.tsx` owns product content and disclosure.

A broad reducer or command framework was rejected because it would add an
abstraction layer without reducing the real React, DOM, GSAP, and
ScrollTrigger ownership.

### 6. Detail content returned to module authority

Menu rows do not pretend unavailable modules exist and do not route on first
activation. A row opens one inline detail region, authentic reference text, and
real T-s geometry; only the explicit CTA navigates to the calculator. The module
registry, presets, and adapters remain the authority for those facts.

## What made the code and tests harder than necessary

### Wrong sequencing

Several individually reasonable ideas were implemented in the wrong order:

1. lifecycle edge cases before a static visual geometry gate;
2. concurrent browser matrices before isolated timer/media ownership;
3. detailed controller interfaces before the consumer transition table;
4. broad audits before a focused causal regression existed;
5. implementation review while the bounded worker state was still changing.

This is the “roof before foundation” failure mode. The correction is not to
avoid rigor; it is to order rigor behind the first observable contract.

### Self-certifying or stale tests

Some early tests compared production-derived values with expectations generated
by the same helpers, inspected synthetic comparator data instead of real source
behavior, or waited for historical bundle names. Those checks could produce
false confidence or false failures while the browser product remained correct.

The current evidence rules are stricter:

- expected semantics come from an independent literal or public behavior;
- comparator negative controls are named as such;
- critical paths also receive an isolated real-source mutation with unchanged
  owning tests;
- bundle/lazy-load tests observe evaluation behavior, not hashed filenames;
- animation tests distinguish product time from browser-harness time;
- browser and process resources have explicit, serial ownership; the canonical
  Playwright matrix uses one worker because its visual journeys share animation
  and WebGL timing.

### Asynchronous infrastructure inside the unit pool

File watchers, generated-output publication, preview-ownership process tests,
evidence finalization, and browser clocks were initially allowed to compete
with unrelated parallel work. Timing failures then looked like product
failures.

Watchers, compiler lifecycles, evidence finalization, and preview ownership now
live in the serial Vitest process-gate project. Watchers observe directories,
serialize dirty work, publish through owned temporary files plus atomic rename,
and drain on signals. The separate Playwright browser gate owns one strict
preview server, runs its visual matrix with one worker, and proves cleanup.
Unit tests remain parallel where isolation is real.

## Current architecture rules

1. `landing-chapters.ts` is the single chapter ID/order authority.
2. Landing state never enters the calculator store.
3. Three YAML/schema pipelines own only their named effects; generated
   TypeScript is checked and never hand-edited.
4. Invalid explicit ownership inputs fail closed; they do not silently select a
   different scroller, diagram, config, or render path.
5. Renderer failure reporting is optional and observation-only; visible
   fallbacks remain product behavior.
6. Production does not ship per-frame test telemetry or query-gated audit
   globals. Tests observe renderer calls, WebGL draws, public phases, and real
   styles from outside the product.
7. Reduced Motion is a first-class terminal behavior, not a late animation
   patch.
8. A cohesive deep module is preferred over both a monolith and a forest of
   one-function files.

## Verification model

The lowest useful layer owns each claim:

| Layer | What it proves |
| --- | --- |
| Pure/unit | math, transition laws, schedules, schemas, literal registry contracts |
| DOM integration | component ownership, disclosure, focus, cleanup, failure boundaries |
| Serial process gates | config watchers, atomic publication, signals, ports, evidence finalization |
| Real-source mutation | the unchanged owning test detects a controlled defect for the intended reason |
| Browser | actual layout, scroll/time interaction, lazy loading, keyboard, themes, Reduced Motion |
| Human visual review | aesthetic meaning and whether the accepted experience is actually desirable |

A GREEN in one layer cannot substitute for another. In particular, technical
tests do not grant visual acceptance or publication authority, and a beautiful
browser result does not prove watcher shutdown or mutation sensitivity.

## Workflow to reuse

For future visual features:

1. write the smallest visible contract and transition table;
2. preserve any accepted base exactly;
3. render one inspectable MVP and obtain the visual/semantic gate;
4. add one lifecycle delta at a time with one focused RED/GREEN;
5. run one containment gate and one independent review;
6. stop when the named contract is proved;
7. record optional improvements separately instead of implementing them by
   default.

If the same causal fix fails twice, or audit/report work grows larger than the
implementation, stop and isolate the missing authority rather than continuing a
broad repair loop.

## Public retrieval route

1. [`src/landing/README.md`](../../src/landing/README.md) — code, config, and
   verification ownership.
2. [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) — application boundaries.
3. [`docs/TESTING.md`](../TESTING.md) — executable evidence rules.
4. [`docs/frontend/MILESTONES.md`](MILESTONES.md) — durable chronology.
5. The nearest implementation and owning test.
