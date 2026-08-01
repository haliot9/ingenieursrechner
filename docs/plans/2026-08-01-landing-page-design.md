# Landing Page Design

**Status:** Approved concept, awaiting implementation-plan review

**Date:** 2026-08-01

**Scope:** Public entry experience for the existing deterministic calculator

## Purpose

The landing page must explain the product before asking visitors to operate it. Its primary audience is recruiters and engineering companies evaluating the repository as evidence of agent-assisted software engineering. Its secondary audience is MINT students looking for a calculator that connects physical assumptions, formulas, and a reproducible handwritten calculation path.

The page demonstrates substance without personal self-promotion. It remains product-first, does not name the author, and does not describe the runtime calculator as an AI service. The product promise remains deterministic: identical physical inputs produce identical results and every derived value has an inspectable path.

## Experience model

The selected structure is a compact hybrid: one cinematic prologue followed by three focused product chapters and a short proof coda. Major chapters are reached by scrolling; depth inside a chapter is opened by clicking or keyboard activation. This prevents a long scroll story from becoming an information-heavy manual.

1. **Wright prologue / attitude**
   - Introduce the product with the supplied Wright Flyer parchment video.
   - Hero headline: `Nicht nur rechnen. Systeme verstehen.`
   - Supporting copy: `Bekannte Größen eingeben. Beziehungen prüfen. Den vollständigen Rechenweg nachvollziehen.`
   - During the paper-collapse transition, use the restrained motto: `Überlieferte Formel ist Ausgangspunkt. Beweis ist das Ziel.`
   - Do not tell a Wright Brothers history or directly compare the creator with them. The reference remains an optional deeper layer for visitors who recognize it.

2. **Module atlas / current scope**
   - Present Thermodynamics as the real available field.
   - Represent additional fields only as a deliberately vague future horizon such as `Weitere Fachgebiete` or `Future Vision`.
   - Never list Robotik, SPS, Strömungsmechanik, or other concrete modules before they exist.

3. **Thermodynamics exploration**
   - A module surface unfolds in place: `Module → Thermodynamik → Kreisprozesse → Carnot / Otto / Diesel / Joule`.
   - Each deeper view is a reversible transition on the same surface, not a separate long page section.
   - Selecting a process exposes a concise detail slot and may draw a mathematically correct SVG process diagram.
   - Visitors can bypass this exploration through navigation and never have to scroll through every process.

4. **Calculation-path proof**
   - Show a concise, authentic excerpt from the existing Joule reference story.
   - Demonstrate the chain from model assumptions through a non-trivial relation to a boxed result.
   - Do not reproduce the entire calculator or full calculation story on the landing page.

5. **Project proof coda**
   - State only verifiable properties: browser-only, deterministic, tested, modular, and prepared for coding agents.
   - Link to the calculator and public repository.
   - Keep architecture and agent workflow compact. Visitors wanting full detail can inspect the repository or give it to their own agent.

## Scrolling and navigation

Scrolling is fluid rather than mandatory slide snapping. When movement slows and a major chapter is already mostly visible, the page may settle gently onto that chapter's intended landing position. This magnetic landing must never trap the user or make reverse scrolling unpredictable.

A compact navigation rail floats above the page rather than occupying layout space. It is inset from the viewport edges, fully rounded, and visually separated from the content by depth and material. Opening it dims and slightly recedes the page underneath without shifting the content.

- Desktop: compact floating control that deliberately opens by click or keyboard activation.
- Mobile: near-full overlay with a visible viewport inset and at least 44 px interaction targets.
- Hover may enhance the response but must never be the only way to open or understand the control.
- Navigation offers direct access to the principal chapters and calculator.
- Back actions inside the exploration reverse the exact transition that opened the current layer.

## Visual identity

Light and dark themes express the same product through two related materials.

- **Light:** technical compendium/editorial character, warm ivory surfaces, restrained serif display typography, and a bronze module plaque.
- **Dark:** digital engineering observatory, modern sans display typography, controlled text gradients, a platinum module plaque, and sparse depth-aware particles.
- Content hierarchy, wording, and interaction behavior stay identical between themes.

The floating navigation uses a liquid-glass material as progressive enhancement. Supported browsers may use controlled displacement or refraction. Safari, Firefox, weaker mobile hardware, and reduced-motion environments receive a deliberate high-quality frosted-glass fallback. In dark mode, a restrained platinum/cyan outer border glow distinguishes the rail from page content. Glow is reserved for active or navigational surfaces rather than every card.

The final typefaces, exact colors, radii, spacing, icons, shadows, and plaque treatment remain implementation-level art direction. Existing prototypes are behavioral and stylistic references, not source code or fixed pixel specifications.

## Wright video treatment

The supplied video is a 1280 × 720, 24 fps H.264 asset with frequent keyframes suitable for scroll-linked playback. Its full frame already contains a warm, irregular parchment background; the apparent pure-white area seen in QuickTime is outside the video.

- Treat the opening as a theme-independent parchment scene.
- Match any surrounding matte to the video's warm edge palette.
- Preserve the complete important motif on narrow screens instead of cropping the aircraft blindly.
- Use scroll position to control playback only while the hero owns the viewport.
- The paper collapse reveals the selected application theme underneath.
- Do not attempt automatic background removal in the first implementation. The parchment, background, and paper ball are too similar for a clean generic key without flicker or halos.

If the integrated asset still exposes visible boundaries, first use soft edge blending or a matched matte. Alpha video, rotoscoping, frame sequences, or WebGL keying are fallback investigations only because they add asset weight, compatibility risk, and maintenance cost.

## Modular implementation boundary

The landing page must not become a second application monolith. Its entry component composes small, independently understandable areas:

- landing shell and chapter order;
- Wright hero and scroll-video controller;
- module atlas;
- thermodynamics explorer;
- calculation-path proof;
- proof coda;
- floating navigation;
- shared theme, material, and motion primitives.

The existing calculator remains intact behind a clear application boundary. Landing content describing available calculators must derive from the existing `MODULES` registry or a small typed presentation adapter over it, not a duplicate hand-maintained availability list. Future modules should appear only when intentionally categorized for the atlas.

The existing custom-SVG decision remains authoritative for physical diagrams. Landing animations may reveal or draw those paths, but image generation and AI video must not be used for mathematical geometry.

No code-graph database is required at the current repository scale. Clear component boundaries, typed registries, an explicit entry flow, and concise durable documentation are sufficient for agent navigation.

## Routing and state

The public root becomes the landing experience. The calculator receives a stable direct entry so existing module exploration remains reachable without replaying the prologue. The implementation plan must choose the lightest routing mechanism compatible with GitHub Pages and relative Vite assets; a new routing dependency is not assumed.

Selecting a process from the landing page should enter the calculator with the corresponding existing module active. Landing-only theme, rail, and exploration state must remain outside the solver store so visual behavior cannot affect accepted numeric state.

## Motion, accessibility, and failure modes

- All primary interactions are keyboard reachable and have visible focus.
- Interactive targets are at least 44 px on mobile.
- Content remains understandable without pointer-reactive effects.
- `prefers-reduced-motion` disables video scrubbing, particles, magnetic settling, distortion animation, and path-drawing choreography. It presents a stable representative frame and direct state changes.
- Unsupported glass effects degrade to readable frost with sufficient contrast.
- Video loading failure leaves the headline, supporting copy, and navigation usable.
- Page motion never changes solver inputs or results.
- Themes must maintain readable copy, diagram strokes, controls, and focus indicators.

## Performance boundaries

- Keep one hero video rather than adding multiple decorative clips.
- Load heavy hero media deliberately and avoid blocking the initial text and navigation.
- Pause scroll-linked work when its section is not visible.
- Prefer CSS transforms and existing custom SVG over canvas or WebGL unless a measured requirement justifies them.
- Avoid adding a general animation dependency until an implementation spike proves that it materially simplifies the video timeline, staggered navigation, and SVG path drawing together.
- Preserve the browser-only privacy contract: no analytics, telemetry, accounts, storage, or remote runtime services.

## Verification contract

Before release, behavior must be protected at the lowest useful level and then verified in a real browser.

- Component tests for landing-versus-calculator entry, navigation, module-registry presentation, theme controls, and reduced-motion behavior.
- Regression coverage that selecting Carnot, Otto, Diesel, or Joule opens the existing corresponding calculator module.
- Existing solver and calculation-story tests remain unchanged and green.
- Full `npm run verify` quality bundle.
- Desktop browser inspection and 390 × 844 mobile inspection.
- Keyboard-only journey through the rail and thermodynamics explorer.
- Normal-motion and reduced-motion inspection.
- Video failure/fallback, console errors, overflow, and GitHub Pages asset paths checked explicitly.

## Non-goals for this iteration

- New engineering solvers or thermodynamic models.
- Rankine/Clausius, steam tables, wet steam, or Mollier diagrams.
- A generalized CAS.
- A full public architecture presentation.
- Personal biography, name, contact data, or claims of individual superiority.
- Concrete promises for future engineering fields.
- Generated physical diagrams or additional cinematic process videos.
- Deployment or publication without separate explicit approval.
