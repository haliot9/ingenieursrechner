# Changelog

Alle bemerkenswerten Änderungen am Ingenieursrechner werden hier dokumentiert.

Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).

## [Unreleased]

### Added
- Ideal air-standard Diesel cycle module with deterministic reference-air preset, SI-safe diagrams, domain validation, and full calculation steps.
- Accessible live-search module picker for registered calculator modules.

### Changed
- Result summaries and process strips are declared by modules instead of hard-coding Carnot wording.

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
