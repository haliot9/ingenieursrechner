# Modular Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cinematic but concise public landing page that introduces the deterministic engineering calculator, lets visitors explore the four real thermodynamic modules, and opens the existing calculator without changing solver behavior.

**Architecture:** Keep the calculator as an isolated page and place a dependency-free URL boundary in front of it. The landing page owns only presentation state; its module cards, reference diagrams, and Joule proof are derived from the existing registry, solver, diagram adapters, and calculation-story composer. Motion is implemented with browser APIs, CSS, and deterministic SVG so no animation framework or second source of physical truth is introduced.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4 plus project-owned CSS, Zustand, KaTeX, custom SVG, Vitest, Testing Library, native History/IntersectionObserver/ResizeObserver APIs.

## Global Constraints

- German user interface; English code and durable engineering documentation.
- The runtime product remains deterministic and browser-only; no AI calculation service, backend, analytics, telemetry, accounts, cookies, or browser storage.
- Identical calculator inputs must continue to produce identical results and inspectable formula paths.
- Landing-only theme, motion, rail, and explorer state must never enter `useCalculatorStore`.
- The four available processes come from the existing module registry: Carnot, Otto, Diesel, and Joule/Brayton.
- Do not advertise concrete future modules before they exist.
- Continue using custom SVG and module `DiagramSpec` adapters for physical diagrams.
- Minimum mobile interaction target: 44 px.
- Required mobile verification viewport: 390 × 844.
- `prefers-reduced-motion` disables video scrubbing, particles, magnetic settling, liquid distortion animation, and path-drawing choreography.
- Do not add a general animation or routing dependency in this iteration.
- Do not push or deploy without separate explicit user approval.

---

## File Structure

```text
src/
├── App.tsx                              # URL-level landing/calculator boundary
├── calculator/
│   └── CalculatorPage.tsx               # Existing calculator UI extracted intact
├── navigation/
│   ├── app-location.ts                  # Pure URL parsing/building
│   └── useAppLocation.ts                # History API integration
└── landing/
    ├── LandingPage.tsx                  # Chapter composition only
    ├── landing.css                      # Landing imports and shared layout
    ├── model/
    │   ├── landing-modules.ts           # Typed registry presentation adapter
    │   ├── reference-scenario.ts        # Pure reference solver/diagram/story adapter
    │   └── joule-proof.ts               # Approved real-story excerpt selection
    ├── motion/
    │   ├── scroll-progress.ts           # Pure scroll/time calculations
    │   ├── useScrollVideo.ts            # Hero video scrubbing lifecycle
    │   ├── useReducedMotion.ts           # Reactive OS accessibility preference
    │   ├── magnetic-target.ts            # Pure landing-point selection
    │   └── useMagneticLanding.ts         # Debounced optional section settling
    ├── theme/
    │   ├── useLandingTheme.ts            # OS preference plus session-only toggle
    │   └── theme.css                     # Light/dark material tokens
    └── components/
        ├── WrightHero.tsx/.css
        ├── FloatingNavigation.tsx/.css
        ├── LiquidSurface.tsx
        ├── ModuleAtlas.tsx/.css
        ├── ThermodynamicsExplorer.tsx/.css
        ├── LandingDiagram.tsx
        ├── JouleProof.tsx/.css
        ├── ProjectCoda.tsx
        └── ParticleField.tsx
public/
├── wright-flyer-scroll-gop6.mp4
└── wright-flyer-poster.webp
tests/
├── navigation/app-location.test.ts
├── components/app-routing.test.tsx
└── landing/*.test.ts(x)
```

### Task 1: Add a stable landing/calculator URL boundary

**Files:**
- Create: `src/navigation/app-location.ts`
- Create: `src/navigation/useAppLocation.ts`
- Create: `src/calculator/CalculatorPage.tsx`
- Create: `src/landing/LandingPage.tsx`
- Modify: `src/App.tsx`
- Modify: `tests/components/app-metadata.test.tsx`
- Create: `tests/navigation/app-location.test.ts`
- Create: `tests/components/app-routing.test.tsx`

**Interfaces:**
- Produces: `AppLocation`, `readAppLocation(search)`, `appLocationHref(location)`, and `useAppLocation()`.
- Produces: `LandingPageProps.onOpenCalculator(moduleId)` for all later landing CTAs.
- Preserves: the current calculator markup and behavior inside `CalculatorPage`.

- [ ] **Step 1: Restore the pinned workspace dependencies**

Run: `npm ci`

Expected: dependency restoration succeeds without modifying `package.json` or `package-lock.json`.

- [ ] **Step 2: Write pure URL tests**

```ts
import { describe, expect, it } from 'vitest'
import { appLocationHref, readAppLocation } from '../../src/navigation/app-location'

describe('app location', () => {
  it('uses the public root as landing page', () => {
    expect(readAppLocation('')).toEqual({ page: 'landing' })
  })

  it('reads a stable calculator entry with a module', () => {
    expect(readAppLocation('?view=calculator&module=joule'))
      .toEqual({ page: 'calculator', moduleId: 'joule' })
  })

  it('builds a GitHub-Pages-safe query URL', () => {
    expect(appLocationHref({ page: 'calculator', moduleId: 'otto' }))
      .toBe('?view=calculator&module=otto')
  })
})
```

- [ ] **Step 3: Run the URL test and confirm the missing-module failure**

Run: `npm test -- tests/navigation/app-location.test.ts`

Expected: FAIL because `src/navigation/app-location.ts` does not exist.

- [ ] **Step 4: Implement the pure URL contract**

```ts
export type AppLocation =
  | { page: 'landing' }
  | { page: 'calculator'; moduleId?: string }

export function readAppLocation(search: string = window.location.search): AppLocation {
  const params = new URLSearchParams(search)
  if (params.get('view') !== 'calculator') return { page: 'landing' }
  const moduleId = params.get('module')?.trim()
  return moduleId ? { page: 'calculator', moduleId } : { page: 'calculator' }
}

export function appLocationHref(location: AppLocation): string {
  if (location.page === 'landing') return './'
  const params = new URLSearchParams({ view: 'calculator' })
  if (location.moduleId) params.set('module', location.moduleId)
  return `?${params.toString()}`
}
```

- [ ] **Step 5: Add the History API hook**

```ts
import { useEffect, useState } from 'react'
import { appLocationHref, readAppLocation, type AppLocation } from './app-location'

export function useAppLocation() {
  const [location, setLocation] = useState<AppLocation>(() => readAppLocation())

  useEffect(() => {
    const sync = () => setLocation(readAppLocation())
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  const navigate = (next: AppLocation) => {
    window.history.pushState({}, '', appLocationHref(next))
    setLocation(next)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  return { location, navigate }
}
```

- [ ] **Step 6: Extract the existing calculator without visual or solver changes**

Move the current contents of `App.tsx` into `src/calculator/CalculatorPage.tsx`. Rename the function to `CalculatorPage`, export it by name, keep the existing store reads/effects/content intact, and change the brand link to an explicit landing callback. The mechanical source changes are:

```diff
-function App() {
+interface CalculatorPageProps { onBackToLanding: () => void }
+export function CalculatorPage({ onBackToLanding }: CalculatorPageProps) {
@@
-          <a className="brand" href="#top" aria-label="Ingenieursrechner Startseite">
+          <button className="brand brand-button" type="button" onClick={onBackToLanding} aria-label="Zur Projektstartseite">
             <span className="brand-mark" aria-hidden="true">IR</span>
             <span>
               <strong>Ingenieursrechner</strong>
               <small>Deterministische Rechenwege</small>
             </span>
-          </a>
+          </button>
@@
-export default App
```

Update relative imports by one directory level. Do not alter any calculator section, solver/store read, conditional rendering branch, or calculation-story behavior.

- [ ] **Step 7: Add a minimal typed landing entry and app switch**

```tsx
// src/landing/LandingPage.tsx
export interface LandingPageProps {
  onOpenCalculator: (moduleId: string) => void
}

export function LandingPage({ onOpenCalculator }: LandingPageProps) {
  return <main aria-labelledby="landing-title">
    <h1 id="landing-title">Nicht nur rechnen. Systeme verstehen.</h1>
    <button type="button" onClick={() => onOpenCalculator('carnot')}>Rechner öffnen</button>
  </main>
}
```

```tsx
// src/App.tsx
import { useEffect } from 'react'
import { CalculatorPage } from './calculator/CalculatorPage'
import { LandingPage } from './landing/LandingPage'
import { getModule } from './modules'
import { useAppLocation } from './navigation/useAppLocation'
import { useCalculatorStore } from './store/calculator-store'

export default function App() {
  const { location, navigate } = useAppLocation()
  const setModule = useCalculatorStore(state => state.setModule)

  useEffect(() => {
    if (location.page === 'calculator' && location.moduleId && getModule(location.moduleId)) {
      setModule(location.moduleId)
    }
  }, [location, setModule])

  return location.page === 'calculator'
    ? <CalculatorPage onBackToLanding={() => navigate({ page: 'landing' })} />
    : <LandingPage onOpenCalculator={moduleId => navigate({ page: 'calculator', moduleId })} />
}
```

- [ ] **Step 8: Add routing component tests and retarget existing calculator tests**

In `app-routing.test.tsx`, mock `window.scrollTo`, use `history.replaceState` before render, and assert the landing headline at `/`, calculator title at `?view=calculator&module=joule`, and that clicking `Rechner öffnen` activates Carnot. Import `CalculatorPage` instead of `App` in existing tests that specifically verify calculator metadata or full Joule rendering and render it as `<CalculatorPage onBackToLanding={() => undefined} />`.

- [ ] **Step 9: Run targeted tests**

Run: `npm test -- tests/navigation/app-location.test.ts tests/components/app-routing.test.tsx tests/components/app-metadata.test.tsx`

Expected: PASS.

- [ ] **Step 10: Commit the isolated entry boundary**

```bash
git add src/App.tsx src/calculator src/navigation src/landing/LandingPage.tsx tests/navigation tests/components/app-routing.test.tsx tests/components/app-metadata.test.tsx
git commit -m "feat: separate landing and calculator entry"
```

### Task 2: Derive landing content and reference evidence from real modules

**Files:**
- Create: `src/landing/model/landing-modules.ts`
- Create: `src/landing/model/reference-scenario.ts`
- Create: `tests/landing/landing-modules.test.ts`
- Create: `tests/landing/reference-scenario.test.ts`

**Interfaces:**
- Produces: `LandingModule`, `THERMODYNAMICS_MODULE_IDS`, and `getThermodynamicsModules()`.
- Produces: `ReferenceScenario` and `buildReferenceScenario(moduleId)`.
- Consumes: `getModule`, `FormulaRegistry`, `solve`, module presets, `getDiagramSpec`, and optional `calculationStory`.

- [ ] **Step 1: Write the registry adapter test**

```ts
import { describe, expect, it } from 'vitest'
import { getThermodynamicsModules } from '../../src/landing/model/landing-modules'

it('presents exactly the registered thermodynamic calculators', () => {
  expect(getThermodynamicsModules().map(module => module.id))
    .toEqual(['carnot', 'otto', 'diesel', 'joule'])
  expect(getThermodynamicsModules().every(module => module.processSequence.length === 4)).toBe(true)
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- tests/landing/landing-modules.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement intentional categorization over the real registry**

```ts
import type { CalculatorModule } from '../../core/types'
import { getModule } from '../../modules'

export const THERMODYNAMICS_MODULE_IDS = ['carnot', 'otto', 'diesel', 'joule'] as const
export type ThermodynamicsModuleId = typeof THERMODYNAMICS_MODULE_IDS[number]

export interface LandingModule {
  id: ThermodynamicsModuleId
  name: string
  description: string
  processSequence: NonNullable<CalculatorModule['processSequence']>
}

export function getThermodynamicsModules(): LandingModule[] {
  return THERMODYNAMICS_MODULE_IDS.map(id => {
    const module = getModule(id)
    if (!module?.processSequence) throw new Error(`Landing module missing registry metadata: ${id}`)
    return { id, name: module.name, description: module.description, processSequence: module.processSequence }
  })
}
```

- [ ] **Step 4: Write reference-scenario tests**

Assert that all four modules produce non-null diagram specs from their own `reference-air` preset, Joule produces a complete story, and `useCalculatorStore.getState().activeModuleId` remains unchanged before and after the pure adapter call.

- [ ] **Step 5: Implement the pure reference adapter**

```ts
import type { CalculationStoryState } from '../../core/calculation-story'
import { FormulaRegistry } from '../../core/formula-registry'
import { solve } from '../../core/solver'
import type { CalculatorModule, DiagramSpec, VariableState } from '../../core/types'
import { getModule } from '../../modules'

export interface ReferenceScenario {
  module: CalculatorModule
  values: Record<string, VariableState>
  diagramSpec: DiagramSpec | null
  story?: CalculationStoryState
}

export function buildReferenceScenario(moduleId: string): ReferenceScenario {
  const module = getModule(moduleId)
  const preset = module?.presets?.find(candidate => candidate.id === 'reference-air')
  if (!module || !preset) throw new Error(`Missing reference-air preset: ${moduleId}`)
  const inputs = Object.fromEntries(Object.entries(preset.values).map(([id, value]) => [id, {
    value,
    unit: module.variables.find(variable => variable.id === id)?.defaultUnit ?? '',
    isUserInput: true,
    isComputed: false,
  }]))
  const result = solve(FormulaRegistry.fromModule(module), module.variables, inputs, [], {
    plannedExecution: module.plannedExecution,
  })
  const story = module.calculationStory?.({
    plan: result.plan,
    steps: result.steps,
    values: result.values,
    variables: module.variables,
  })
  return {
    module,
    values: result.values,
    diagramSpec: module.getDiagramSpec?.(result.values) ?? null,
    story,
  }
}
```

- [ ] **Step 6: Run model tests**

Run: `npm test -- tests/landing/landing-modules.test.ts tests/landing/reference-scenario.test.ts`

Expected: PASS with four real diagram specs and a complete Joule story.

- [ ] **Step 7: Commit the landing model seam**

```bash
git add src/landing/model tests/landing/landing-modules.test.ts tests/landing/reference-scenario.test.ts
git commit -m "feat: expose real module evidence to landing page"
```

### Task 3: Establish the two-material theme and landing shell

**Files:**
- Create: `src/landing/theme/useLandingTheme.ts`
- Create: `src/landing/motion/useReducedMotion.ts`
- Create: `src/landing/theme/theme.css`
- Create: `src/landing/landing.css`
- Modify: `src/landing/LandingPage.tsx`
- Create: `tests/landing/landing-theme.test.tsx`

**Interfaces:**
- Produces: `LandingTheme = 'light' | 'dark'`, `useLandingTheme()`, and reactive `useReducedMotion()`.
- Produces: root attributes `data-landing-theme` and `data-reduced-motion` consumed by every visual component.

- [ ] **Step 1: Write a theme behavior test**

Mock `window.matchMedia`, render `LandingPage`, assert the OS-preferred theme is used, click the `Darstellung wechseln` button, and assert the root changes theme without any `localStorage` call.

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- tests/landing/landing-theme.test.tsx`

Expected: FAIL because no theme control exists.

- [ ] **Step 3: Implement a session-only theme hook**

```ts
import { useState } from 'react'

export type LandingTheme = 'light' | 'dark'

export function useLandingTheme() {
  const [theme, setTheme] = useState<LandingTheme>(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  return {
    theme,
    toggleTheme: () => setTheme(current => current === 'light' ? 'dark' : 'light'),
  }
}
```

Implement the accessibility preference as a separate reactive hook:

```ts
import { useEffect, useState } from 'react'

export function useReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => window.matchMedia?.(query).matches ?? false)
  useEffect(() => {
    const media = window.matchMedia(query)
    const sync = () => setReduced(media.matches)
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])
  return reduced
}
```

- [ ] **Step 4: Define the material tokens**

```css
.landing-shell {
  --landing-bg: #f1ede4;
  --landing-surface: rgba(250, 247, 239, .78);
  --landing-ink: #191b1e;
  --landing-muted: #65625d;
  --landing-metal: #9a6036;
  --landing-metal-soft: #d3aa78;
  --landing-line: rgba(63, 52, 42, .2);
  --landing-glow: transparent;
  min-height: 100vh;
  color: var(--landing-ink);
  background: var(--landing-bg);
}

.landing-shell[data-landing-theme="dark"] {
  --landing-bg: #080b12;
  --landing-surface: rgba(17, 23, 34, .62);
  --landing-ink: #f3f6fb;
  --landing-muted: #aab5c5;
  --landing-metal: #c6cfda;
  --landing-metal-soft: #eef3f8;
  --landing-line: rgba(185, 205, 229, .18);
  --landing-glow: rgba(100, 205, 255, .42);
}
```

Add shared section width, typography, focus, 44 px control, and overflow rules in `landing.css`; import `theme.css` from it. Use local/system font stacks only: an editorial Georgia/Cambria stack for light display headings and an Inter/DM Sans/system stack for dark display headings. Apply a restrained silver-to-cyan text gradient to the main dark heading while preserving a solid readable fallback color.

- [ ] **Step 5: Wire the root theme and accessible control**

The `LandingPage` root receives `data-landing-theme={theme}`. The toggle has `aria-label="Darstellung wechseln"`, `aria-pressed={theme === 'dark'}`, visible text for the next mode, and does not write browser storage.

- [ ] **Step 6: Run theme and routing tests**

Run: `npm test -- tests/landing/landing-theme.test.tsx tests/components/app-routing.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit the base identity**

```bash
git add src/landing/theme src/landing/motion/useReducedMotion.ts src/landing/landing.css src/landing/LandingPage.tsx tests/landing/landing-theme.test.tsx
git commit -m "feat: add landing page material themes"
```

### Task 4: Build the Wright scroll-video prologue with a resilient fallback

**Files:**
- Copy: `/Users/tristanwolftheimert/Downloads/wright-flyer-scroll-gop6.mp4` → `public/wright-flyer-scroll-gop6.mp4`
- Create: `public/wright-flyer-poster.webp`
- Create: `src/landing/motion/scroll-progress.ts`
- Create: `src/landing/motion/useScrollVideo.ts`
- Create: `src/landing/components/WrightHero.tsx`
- Create: `src/landing/components/WrightHero.css`
- Create: `tests/landing/scroll-progress.test.ts`
- Create: `tests/landing/wright-hero.test.tsx`

**Interfaces:**
- Produces: `scrollProgress(rectTop, sectionHeight, viewportHeight)` returning a clamped `0..1` value.
- Produces: `useScrollVideo(sectionRef, videoRef, reducedMotion)`.
- Produces: the `#haltung` major chapter.

- [ ] **Step 1: Write the pure progress test**

```ts
expect(scrollProgress(0, 2400, 800)).toBe(0)
expect(scrollProgress(-800, 2400, 800)).toBeCloseTo(.5)
expect(scrollProgress(-1600, 2400, 800)).toBe(1)
expect(scrollProgress(200, 2400, 800)).toBe(0)
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- tests/landing/scroll-progress.test.ts`

Expected: FAIL because the helper is missing.

- [ ] **Step 3: Implement the clamped mapping**

```ts
export function scrollProgress(top: number, sectionHeight: number, viewportHeight: number): number {
  const distance = Math.max(1, sectionHeight - viewportHeight)
  return Math.min(1, Math.max(0, -top / distance))
}
```

- [ ] **Step 4: Add the optimized video assets**

Run:

```bash
cp /Users/tristanwolftheimert/Downloads/wright-flyer-scroll-gop6.mp4 public/wright-flyer-scroll-gop6.mp4
ffmpeg -y -ss 0.25 -i public/wright-flyer-scroll-gop6.mp4 -frames:v 1 -vf scale=1280:-2 -quality 82 public/wright-flyer-poster.webp
```

Verify with: `ffprobe -v error -show_entries stream=codec_name,pix_fmt,width,height,r_frame_rate -of default=nw=1 public/wright-flyer-scroll-gop6.mp4`

Expected: H.264, `yuv420p`, 1280 × 720, 24 fps.

- [ ] **Step 5: Implement the scrub lifecycle without React rerenders per frame**

`useScrollVideo` must attach passive `scroll` and `resize` listeners only while an `IntersectionObserver` reports the hero visible. A single `requestAnimationFrame` reads the section rectangle and writes `video.currentTime = progress * duration`. On reduced motion, remove listeners and set a stable representative time after metadata loads.

```ts
const update = () => {
  frame = undefined
  const section = sectionRef.current
  const video = videoRef.current
  if (!section || !video || !Number.isFinite(video.duration)) return
  const rect = section.getBoundingClientRect()
  video.currentTime = scrollProgress(rect.top, rect.height, window.innerHeight) * video.duration
}
```

- [ ] **Step 6: Write and implement the hero component**

The test must assert `muted`, `playsInline`, `preload="metadata"`, poster/source paths, the exact headline/support/motto, and usable copy when a video error event is fired.

```tsx
<section id="haltung" ref={sectionRef} className="wright-hero" aria-labelledby="landing-title">
  <div className="wright-hero-sticky">
    <video ref={videoRef} muted playsInline preload="metadata" poster="./wright-flyer-poster.webp" aria-hidden="true">
      <source src="./wright-flyer-scroll-gop6.mp4" type="video/mp4" />
    </video>
    <div className="wright-hero-copy">
      <p>Deterministische Rechenwege</p>
      <h1 id="landing-title">Nicht nur rechnen. Systeme verstehen.</h1>
      <p>Bekannte Größen eingeben. Beziehungen prüfen. Den vollständigen Rechenweg nachvollziehen.</p>
    </div>
    <p className="wright-motto">Überlieferte Formel ist Ausgangspunkt. Beweis ist das Ziel.</p>
  </div>
</section>
```

Use a 16:9 video layer over a matched parchment matte; keep the important frame contained on narrow screens. Fade the matte into the selected theme near the final scroll interval. Do not key or remove the baked parchment background.

- [ ] **Step 7: Run hero tests**

Run: `npm test -- tests/landing/scroll-progress.test.ts tests/landing/wright-hero.test.tsx`

Expected: PASS in normal and reduced-motion branches.

- [ ] **Step 8: Commit the prologue**

```bash
git add public/wright-flyer-scroll-gop6.mp4 public/wright-flyer-poster.webp src/landing/motion src/landing/components/WrightHero.tsx src/landing/components/WrightHero.css tests/landing/scroll-progress.test.ts tests/landing/wright-hero.test.tsx
git commit -m "feat: add scroll-linked Wright prologue"
```

### Task 5: Add the floating liquid-glass navigation rail

**Files:**
- Create: `src/landing/components/LiquidSurface.tsx`
- Create: `src/landing/components/FloatingNavigation.tsx`
- Create: `src/landing/components/FloatingNavigation.css`
- Create: `tests/landing/floating-navigation.test.tsx`

**Interfaces:**
- Consumes: `LandingTheme`, `onToggleTheme: () => void`, and `onOpenCalculator: () => void`.
- Produces: overlay navigation for `haltung`, `module`, `thermodynamik`, `rechenweg`, and `projekt`.

- [ ] **Step 1: Write navigation behavior tests**

Test that the compact trigger opens a `role="dialog"`, Escape closes it, clicking a chapter invokes `scrollIntoView` and closes it, the theme control calls its callback, and `Rechner öffnen` calls the supplied zero-argument callback. The `LandingPage` closure owns the selected module ID; the rail must not duplicate module state.

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- tests/landing/floating-navigation.test.tsx`

Expected: FAIL because the rail does not exist.

- [ ] **Step 3: Implement progressive liquid support selection**

```ts
export function supportsLiquidDistortion(userAgent: string, reducedMotion: boolean, coarsePointer: boolean) {
  const firefox = /Firefox/i.test(userAgent)
  const safari = /Safari/i.test(userAgent) && !/Chrome|Chromium|Edg/i.test(userAgent)
  return !reducedMotion && !coarsePointer && !firefox && !safari
}
```

`LiquidSurface` renders the SVG displacement filter only when this function returns true. Every other case uses the same readable children inside a frosted surface with `backdrop-filter`, translucent border, and solid-color fallback. Use a unique React `useId()` filter ID so multiple surfaces never collide:

```tsx
const filterId = useId().replaceAll(':', '')
return <div className="liquid-surface" data-liquid-mode={enabled ? 'distortion' : 'frosted'}>
  {enabled && <svg width="0" height="0" aria-hidden="true">
    <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="17" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="14" xChannelSelector="R" yChannelSelector="B" />
    </filter>
  </svg>}
  <div className="liquid-surface-refraction" aria-hidden="true" style={enabled ? { filter: `url(#${filterId})` } : undefined} />
  <div className="liquid-surface-content">{children}</div>
</div>
```

Keep `.liquid-surface-content` above the filtered refraction layer so labels and controls are never warped or made less readable.

- [ ] **Step 4: Implement deliberate open/close and focus behavior**

Use a button with `aria-expanded` and `aria-controls`. When opening, remember the trigger, focus the dialog heading or first link, close on Escape, and return focus to the trigger. Add a fixed full-screen dimmer behind the inset rounded panel; do not shift page layout.

- [ ] **Step 5: Add restrained dark boundary glow and pointer response**

Use CSS custom properties updated from `pointermove` on the surface element. The liquid/refraction layer may respond to the pointer, while the dark outer glow remains a controlled boundary rather than a full-card neon effect.

```css
.floating-rail-panel {
  position: fixed;
  inset: clamp(14px, 3vw, 32px);
  border-radius: clamp(24px, 3vw, 42px);
  background: var(--landing-surface);
  border: 1px solid var(--landing-line);
  box-shadow: 0 28px 90px rgba(0, 0, 0, .28), 0 0 34px var(--landing-glow);
}
```

- [ ] **Step 6: Run navigation and theme tests**

Run: `npm test -- tests/landing/floating-navigation.test.tsx tests/landing/landing-theme.test.tsx`

Expected: PASS, including keyboard close and focus restoration.

- [ ] **Step 7: Commit the floating rail**

```bash
git add src/landing/components/LiquidSurface.tsx src/landing/components/FloatingNavigation.tsx src/landing/components/FloatingNavigation.css tests/landing/floating-navigation.test.tsx
git commit -m "feat: add floating liquid navigation"
```

### Task 6: Present the honest module atlas

**Files:**
- Create: `src/landing/components/ModuleAtlas.tsx`
- Create: `src/landing/components/ModuleAtlas.css`
- Create: `tests/landing/module-atlas.test.tsx`

**Interfaces:**
- Consumes: `getThermodynamicsModules()`.
- Produces: `#module` chapter and `onExploreThermodynamics()` activation.

- [ ] **Step 1: Write content-boundary tests**

Assert that the section shows `Thermodynamik`, the four real process names, and a generic `Weitere Fachgebiete` future surface. Assert that `Robotik`, `SPS`, `Rankine`, and `Strömungsmechanik` are absent. Assert the Thermodynamics action invokes the callback.

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- tests/landing/module-atlas.test.tsx`

Expected: FAIL because the atlas does not exist.

- [ ] **Step 3: Implement the registry-backed atlas**

```tsx
export function ModuleAtlas({ onExploreThermodynamics }: { onExploreThermodynamics: () => void }) {
  const modules = getThermodynamicsModules()
  return <section id="module" className="module-atlas" aria-labelledby="module-title">
    <p className="landing-eyebrow">Modulatlas</p>
    <h2 id="module-title">Ein System. Endliche, prüfbare Rechenräume.</h2>
    <button type="button" className="module-plaque" onClick={onExploreThermodynamics}>
      <span>Aktives Fachgebiet</span><strong>Thermodynamik</strong>
      <small>{modules.map(module => module.name).join(' · ')}</small>
    </button>
    <article className="future-module" aria-label="Weitere Fachgebiete in Zukunft">
      <span>Future Vision</span><strong>Weitere Fachgebiete</strong>
      <p>Neue Rechenräume erscheinen erst, wenn Modell, Solverpfad und Erklärung belastbar sind.</p>
    </article>
  </section>
}
```

- [ ] **Step 4: Style bronze-to-platinum material without duplicating content**

Use theme variables for the plaque material, an engraved border, restrained pointer spotlight, and identical DOM in both themes. The future surface is visually quieter than the active field.

- [ ] **Step 5: Run the atlas test**

Run: `npm test -- tests/landing/module-atlas.test.tsx`

Expected: PASS with no concrete unimplemented module names.

- [ ] **Step 6: Commit the honest atlas**

```bash
git add src/landing/components/ModuleAtlas.tsx src/landing/components/ModuleAtlas.css tests/landing/module-atlas.test.tsx
git commit -m "feat: add registry-backed module atlas"
```

### Task 7: Build the reversible Thermodynamics explorer and real diagrams

**Files:**
- Create: `src/landing/components/ThermodynamicsExplorer.tsx`
- Create: `src/landing/components/LandingDiagram.tsx`
- Create: `src/landing/components/ThermodynamicsExplorer.css`
- Create: `tests/landing/thermodynamics-explorer.test.tsx`

**Interfaces:**
- Consumes: `getThermodynamicsModules()` and `buildReferenceScenario(moduleId)`.
- Produces: `#thermodynamik`, `onSelectionChange(moduleId)`, and `onOpenCalculator(moduleId)`.

- [ ] **Step 1: Write the exploration state tests**

Render the explorer and assert the visible path progresses through `Thermodynamik`, `Kreisprozesse`, and the four liquid-glass controls. Click Carnot and assert its description, four process steps, a `T-s Diagramm`, `Im Rechner öffnen`, and a `Zurück` control. Click Back and assert the process controls return. Repeat the calculator callback assertion for all four module IDs.

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- tests/landing/thermodynamics-explorer.test.tsx`

Expected: FAIL because the explorer is missing.

- [ ] **Step 3: Implement one-surface reversible state**

```ts
type ExplorerLayer = 'field' | 'branch' | 'cycles' | 'detail'
const [layer, setLayer] = useState<ExplorerLayer>('field')
const [selectedId, setSelectedId] = useState<ThermodynamicsModuleId>('carnot')
```

Each activation advances exactly one layer. Back maps `detail → cycles → branch → field`. Use one bounded stage with keyed inner panels and `aria-live="polite"`; do not append long sections below it.

- [ ] **Step 4: Reuse the existing diagram renderer**

```tsx
import { TSDiagram } from '../../components/diagrams/TSDiagram'
import type { DiagramSpec } from '../../core/types'

export function LandingDiagram({ spec }: { spec: DiagramSpec }) {
  return <div className="landing-diagram" aria-label="Referenzdiagramm">
    <TSDiagram spec={spec} />
  </div>
}
```

Build the selected reference scenario with `useMemo`, render the existing mathematically derived spec, and apply stroke-dash reveal only as presentation. Do not author a second set of cycle coordinates.

- [ ] **Step 5: Add morphing-unfold styling**

Use transforms, opacity, and clip paths on the keyed inner panel. Keep the outer stage dimensions stable enough to prevent scroll jumps. Set direct state changes under reduced motion. Make each process control at least 44 px and keep selected/focus states legible in both themes.

- [ ] **Step 6: Run explorer and reference tests**

Run: `npm test -- tests/landing/thermodynamics-explorer.test.tsx tests/landing/reference-scenario.test.ts`

Expected: PASS with real registry content and existing SVG diagrams.

- [ ] **Step 7: Commit the explorer**

```bash
git add src/landing/components/ThermodynamicsExplorer.tsx src/landing/components/LandingDiagram.tsx src/landing/components/ThermodynamicsExplorer.css tests/landing/thermodynamics-explorer.test.tsx
git commit -m "feat: add reversible thermodynamics explorer"
```

### Task 8: Show an authentic Joule proof excerpt and compact project coda

**Files:**
- Create: `src/landing/model/joule-proof.ts`
- Create: `src/landing/components/JouleProof.tsx`
- Create: `src/landing/components/JouleProof.css`
- Create: `src/landing/components/ProjectCoda.tsx`
- Create: `tests/landing/joule-proof.test.tsx`
- Create: `tests/landing/project-coda.test.tsx`

**Interfaces:**
- Consumes: the complete real Joule reference story from `buildReferenceScenario('joule')`.
- Produces: `getJouleProofExcerpt()` with real `CalculationStoryRow` objects.
- Produces: `#rechenweg` and `#projekt` chapters.

- [ ] **Step 1: Write the proof authority test**

Assert the excerpt row IDs are exactly:

```ts
[
  'energy:model-reduction',
  'energy:reduced',
  'energy:enthalpy',
  'energy:qin',
  'energy:qin:numeric',
]
```

Assert the rendered section contains `q`, `h`, `c_p`, `T`, a boxed result surface, and no `katex-error`.

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- tests/landing/joule-proof.test.tsx`

Expected: FAIL because the selector and renderer do not exist.

- [ ] **Step 3: Select rows from the real story by stable semantic IDs**

```ts
import type { CalculationStoryRow } from '../../core/calculation-story'
import { buildReferenceScenario } from './reference-scenario'

const PROOF_IDS = ['energy:model-reduction', 'energy:reduced', 'energy:enthalpy', 'energy:qin', 'energy:qin:numeric'] as const

export function getJouleProofExcerpt(): CalculationStoryRow[] {
  const story = buildReferenceScenario('joule').story
  if (story?.mode !== 'complete') throw new Error('Joule reference story unavailable')
  return PROOF_IDS.map(id => {
    const row = story.story.rows.find(candidate => candidate.id === id)
    if (!row) throw new Error(`Joule proof row missing: ${id}`)
    return row
  })
}
```

- [ ] **Step 4: Render the concise equation spine with the existing KaTeX helper**

Use `renderLatex(row.equationLatex, true)` and `dangerouslySetInnerHTML` only with these repository-authored strings. Mark the final numeric row as the visual result. Explain in one short paragraph that assumptions reduce the general control-volume balance before `q = Δh = c_p(T_3-T_2)` becomes valid.

- [ ] **Step 5: Write and implement the factual coda**

Test and render only these proof points: `Browser-only`, `Deterministisch`, `Getestet`, `Modular`, `Agent-ready`. Link the repository to `https://github.com/haliot9/ingenieursrechner` and expose a calculator callback. Do not include a personal name, contact data, biography, or “AI-powered calculator” wording.

- [ ] **Step 6: Run proof and coda tests**

Run: `npm test -- tests/landing/joule-proof.test.tsx tests/landing/project-coda.test.tsx`

Expected: PASS with real story rows and factual project claims.

- [ ] **Step 7: Commit product evidence**

```bash
git add src/landing/model/joule-proof.ts src/landing/components/JouleProof.tsx src/landing/components/JouleProof.css src/landing/components/ProjectCoda.tsx tests/landing/joule-proof.test.tsx tests/landing/project-coda.test.tsx
git commit -m "feat: present real Joule proof on landing page"
```

### Task 9: Compose the chapters, particles, and gentle magnetic landings

**Files:**
- Create: `src/landing/components/ParticleField.tsx`
- Create: `src/landing/motion/magnetic-target.ts`
- Create: `src/landing/motion/useMagneticLanding.ts`
- Modify: `src/landing/LandingPage.tsx`
- Modify: `src/landing/landing.css`
- Create: `tests/landing/magnetic-target.test.ts`
- Create: `tests/landing/landing-page.test.tsx`

**Interfaces:**
- Consumes: every landing component from Tasks 3–8.
- Produces: the complete five-chapter public experience and section list used by the floating rail.

- [ ] **Step 1: Write the pure magnetic-target tests**

Use section candidates with `{ id, visibleRatio, distanceToLanding }`. Assert no result below `0.72` visibility, no result beyond `120` px, and the nearest qualified section wins. Assert reduced motion always returns `undefined`.

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- tests/landing/magnetic-target.test.ts`

Expected: FAIL because the target selector is missing.

- [ ] **Step 3: Implement conservative target selection**

```ts
export interface MagneticCandidate { id: string; visibleRatio: number; distanceToLanding: number }

export function chooseMagneticTarget(candidates: MagneticCandidate[], reducedMotion: boolean) {
  if (reducedMotion) return undefined
  return candidates
    .filter(candidate => candidate.visibleRatio >= .72 && Math.abs(candidate.distanceToLanding) <= 120)
    .sort((a, b) => Math.abs(a.distanceToLanding) - Math.abs(b.distanceToLanding))[0]?.id
}
```

- [ ] **Step 4: Implement optional settling without scroll traps**

`useMagneticLanding` observes only the five major chapter elements, waits 140 ms after the last scroll event, aborts when a pointer/touch remains active, and calls `scrollIntoView({ behavior: 'smooth', block: 'start' })` at most once per settled chapter. Reset that guard after a different chapter becomes dominant so returning later still works. Clear every timer/listener on cleanup. Never intercept wheel, touchmove, PageUp/PageDown, or arrow-key events.

- [ ] **Step 5: Add deterministic dark particles**

`ParticleField` renders a fixed typed array of 24 positions and depths; it never calls `Math.random`. Hide it in light or reduced-motion modes. Pointer parallax writes CSS variables on one container and stops outside the viewport.

- [ ] **Step 6: Compose the complete page**

```tsx
<div className="landing-shell" data-landing-theme={theme} data-reduced-motion={reducedMotion}>
  <ParticleField enabled={theme === 'dark' && !reducedMotion} />
  <FloatingNavigation sections={sections} theme={theme} onToggleTheme={toggleTheme} onOpenCalculator={openSelected} />
  <WrightHero reducedMotion={reducedMotion} />
  <ModuleAtlas onExploreThermodynamics={() => scrollTo('thermodynamik')} />
  <ThermodynamicsExplorer onSelectionChange={setSelectedModuleId} onOpenCalculator={onOpenCalculator} />
  <JouleProof onOpenCalculator={() => onOpenCalculator('joule')} />
  <ProjectCoda onOpenCalculator={() => onOpenCalculator(selectedModuleId)} />
</div>
```

Set `document.title = 'Ingenieursrechner · Systeme verstehen'` on landing mount and retain module-specific titles inside `CalculatorPage`.

- [ ] **Step 7: Write the full-page contract test**

Assert the exact hero headline, five section landmarks, four real module names, future copy without forbidden concrete modules, navigation dialog, theme control, repository link, and calculator callback. Render once with reduced motion and assert particles are absent while all content remains.

- [ ] **Step 8: Run all landing tests**

Run: `npm test -- tests/landing tests/components/app-routing.test.tsx`

Expected: PASS.

- [ ] **Step 9: Commit the composed experience**

```bash
git add src/landing/LandingPage.tsx src/landing/landing.css src/landing/components/ParticleField.tsx src/landing/motion/magnetic-target.ts src/landing/motion/useMagneticLanding.ts tests/landing/magnetic-target.test.ts tests/landing/landing-page.test.tsx
git commit -m "feat: compose modular landing experience"
```

### Task 10: Document, verify, and present the local promo

**Files:**
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/DECISIONS.md`
- Modify only if evidence changes: `CHANGELOG.md`

**Interfaces:**
- Documents: public root, direct calculator query entry, landing/solver state boundary, and native-motion decision.
- Produces: browser evidence at desktop and 390 × 844 plus a local interactive promo URL.

- [ ] **Step 1: Update durable documentation**

Change the README lead link from `Live calculator` to `Live project`, add a direct calculator link using `?view=calculator`, and add a short landing-page paragraph. In architecture, add:

```text
URL boundary
├── Landing presentation state → registry/reference adapters → existing SVG/story evidence
└── Calculator page → Zustand store → deterministic solver
```

Record in `DECISIONS.md` that the page uses query-based navigation for GitHub Pages compatibility and native browser/CSS motion to avoid a new dependency.

- [ ] **Step 2: Run formatting and targeted behavior checks**

Run:

```bash
git diff --check
npm test -- tests/navigation tests/landing tests/components/app-routing.test.tsx tests/components/app-metadata.test.tsx
```

Expected: no whitespace errors and all targeted tests pass.

- [ ] **Step 3: Run the complete quality bundle**

Run: `npm run verify`

Expected: all tests, lint, production build, and production dependency audit pass. Report any development-only audit separately and do not mislabel it as a runtime failure.

- [ ] **Step 4: Inspect the production asset result**

Run:

```bash
du -h public/wright-flyer-scroll-gop6.mp4 public/wright-flyer-poster.webp
find dist -maxdepth 2 -type f -print
```

Confirm the video/poster paths exist in `dist`, the video remains the only cinematic clip, and no remote font, analytics, telemetry, or runtime API was introduced.

- [ ] **Step 5: Start the local promo**

Run: `npm run dev -- --host 127.0.0.1`

Open the resulting local URL in the in-app browser and keep it running for user review.

- [ ] **Step 6: Verify desktop normal-motion journey**

At approximately 1440 × 900:

1. Load the root and inspect console for errors.
2. Scroll forward and backward through the Wright video.
3. Confirm parchment-to-theme transition has no pure-white rectangle.
4. Open/close the floating rail and switch themes.
5. Explore Thermodynamics through Carnot and Joule, including back transitions and diagram drawing.
6. Open Joule in the calculator and load `Referenzfall Luft`.
7. Confirm the existing full calculation story and diagrams still render.
8. Use browser Back to return to the landing page.

- [ ] **Step 7: Verify mobile and keyboard journeys**

At 390 × 844:

1. Confirm no horizontal page overflow and no important Wright motif is clipped.
2. Confirm every primary target is at least 44 px.
3. Open the near-full inset rail, traverse it with keyboard, close with Escape, and verify focus restoration.
4. Explore a process and reverse with Back.
5. Enable reduced motion and confirm stable poster/direct transitions/no particles/no magnetic settling.

- [ ] **Step 8: Review the complete diff and commit documentation**

Run:

```bash
git status --short
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- src/core src/modules src/store
```

Expected: no solver/formula/module/store production changes except intentional imports through public interfaces. Then commit:

```bash
git add README.md docs/ARCHITECTURE.md docs/DECISIONS.md CHANGELOG.md
git commit -m "docs: describe landing page boundary"
```

If `CHANGELOG.md` did not require an evidence update, omit it from `git add`.

- [ ] **Step 9: Present the promo without publishing**

Give the user the running local URL, summarize verified desktop/mobile/reduced-motion behavior, identify any visual details worth tuning interactively, and explicitly state that nothing has been pushed or deployed.
