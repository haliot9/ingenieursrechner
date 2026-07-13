# Carnot Public Release

Date: 2026-07-13
Status: COMPLETED

## Goal

Ship the existing Carnot calculator as a correct, documented, responsive public web application.

## Completed

- [x] Restored the corrupted dependency tree with `npm ci`
- [x] Re-verified the existing 90-test solver baseline
- [x] Added computed-result constraint validation
- [x] Added the deterministic reference-air preset
- [x] Fixed stale visible values after reset
- [x] Fixed significant trailing-zero removal (`200000` no longer displays as `2`)
- [x] Fixed TypeScript SVG anchor error
- [x] Fixed React Fast Refresh lint boundary for diagram colors
- [x] Rebuilt the information hierarchy and responsive industrial UI
- [x] Added summary metrics, process strip, collapsible groups, and calculation steps
- [x] Verified desktop reference-case rendering and both diagrams
- [x] Verified initial mobile layout in Chrome at 390×844
- [x] Updated dependencies to zero `npm audit` findings
- [x] Replaced the template README and added release quality evidence
- [x] Added GitHub Pages deployment workflow
- [x] Corrected diagram SI/display-unit boundaries after independent domain audit
- [x] Added strict engine-mode constraints and module-level contradiction checks
- [x] Added keyboard-focusable diagram points and an explanatory empty state

## Publication

- [x] Authenticated GitHub CLI for the `haliot9` account
- [x] Initialized Git and created the public GitHub repository
- [x] Pushed `main`
- [x] Enabled and verified GitHub Pages Actions deployment
- [x] Verified the public URL on the outer browser boundary

Public URL: `https://haliot9.github.io/ingenieursrechner/`
Repository: `https://github.com/haliot9/ingenieursrechner`

## Release checks

```bash
npm test
npm run lint
npm run build
npm audit
```

Expected local gate:

- 104 tests pass
- lint exits 0
- build exits 0
- audit reports 0 vulnerabilities

## Known non-blocking limitation

The production bundle is approximately 1.18 MB before gzip because math.js and KaTeX are shipped client-side. Vite emits a chunk-size warning, but the application builds and runs correctly. Code splitting is a future performance optimization, not a correctness blocker for this release.
