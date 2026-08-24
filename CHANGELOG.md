# Changelog

Alle bemerkenswerten Änderungen am Ingenieursrechner werden hier dokumentiert.

Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).

## [Unreleased]

### Added
- Ideal air-standard Otto cycle module with deterministic reference-air preset, SI-safe diagrams, domain validation, and full calculation steps.
- Ideal air-standard Diesel cycle module with deterministic reference-air preset, SI-safe diagrams, domain validation, and full calculation steps.
- Accessible live-search module picker for registered calculator modules.
- Landing cold-start guide, concise milestone map, and public engineering
  journey: [src/landing/README.md](src/landing/README.md),
  [docs/frontend/MILESTONES.md](docs/frontend/MILESTONES.md), and
  [docs/frontend/LANDING_ENGINEERING_JOURNEY.md](docs/frontend/LANDING_ENGINEERING_JOURNEY.md).
- Tracked, isolated-copy procedure for proving three critical Landing contracts
  with real-source mutants and unchanged owning tests; one-command automation
  remains open debt.

### Changed
- Result summaries and process strips are declared by modules instead of hard-coding Carnot wording.
- Landing checks run unit and process-gate projects sequentially; the serial
  process project owns config/HMR, preview-server, and evidence-finalizer gates.
- Landing generated-config publication is atomic and shutdown-safe, Playwright
  owns a strict non-reused preview server and serial visual matrix, and
  chapter/CSS/renderer-diagnostic ownership is explicit without changing the
  accepted visible experience.
- Comparator clone checks are named as negative controls instead of being
  presented as production mutation evidence.
- Background and Elastic YAML now expose their schemas, units, ranges, formulas,
  and visible ownership to editors while preserving all values and generated
  runtime output.
- Tailwind's Vite integration is classified as build tooling, so the blocking
  production audit reflects only packages shipped in the browser runtime;
  development-tool advisories remain separately reportable.

## [0.1.0] - 2026-02-22

### Added
- Projekt-Setup: React + TypeScript + Vite
- Core Engine: Fixed-Point Solver, FormulaRegistry, StepTracker
- Einheiten-Konvertierung via math.js
- Input-Validierung mit Constraints
- Carnot-Modul: Ideale Gasgleichung, Mayer, Adiabaten, Wirkungsgrad, 1. Hauptsatz
- KaTeX-basierte LaTeX-Darstellung der Rechenschritte
- Editierbare Wertetabelle mit Live-Berechnung
- Dark Theme UI mit Tailwind CSS
