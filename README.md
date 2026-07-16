# Ingenieursrechner

[**Live calculator → haliot9.github.io/ingenieursrechner**](https://haliot9.github.io/ingenieursrechner/)

A deterministic, browser-based engineering calculator that derives every solvable quantity from the values provided and exposes the complete calculation path.

The current production-ready modules cover the ideal Carnot cycle, the ideal air-standard Diesel cycle, and the ideal air-standard Otto cycle.

## Privacy

The application runs entirely in the browser. It has no accounts, analytics, cookies, telemetry, backend API, or browser storage, and it does not transmit calculation inputs. Fonts and application assets are bundled or provided by the local operating system.

The public site is hosted by GitHub Pages; normal connection metadata is therefore processed under GitHub's privacy terms.

## What the thermodynamic modules provide

- Automatic fixed-point solving from partial input sets
- SI-based internal calculations with selectable display units
- Four thermodynamic state points
- Ideal-gas, isothermal, adiabatic, entropy, energy-balance, and efficiency relations
- Responsive p-v and T-s diagrams
- Expandable KaTeX calculation steps
- A validated reference-air preset
- Input and computed-result constraint validation
- Mobile-first cards and 44 px minimum interactive targets

## Reference case

Use **Referenzfall Luft** in the UI to load:

| Input | Value |
|---|---:|
| $T_1$ | 250 K |
| $T_3$ | 500 K |
| $p_2$ | 1 MPa |
| $p_3$ | 200 kPa |
| $R_s$ | 287 J/(kg·K) |
| $\kappa$ | 1.4 |

Expected core results:

- $\eta = 50\%$
- $q_{in} \approx 230.95\,\mathrm{kJ/kg}$
- $q_{out} \approx -115.48\,\mathrm{kJ/kg}$
- $w_{netto} \approx -115.48\,\mathrm{kJ/kg}$

Sign convention: heat entering the system is positive; heat and work leaving the system are negative.

## Local development

Requirements: Node.js 22+ and npm 10+.

```bash
npm ci
npm run dev
```

Quality gate:

```bash
npm run verify
```

This runs the complete test, lint, production-build, and high-severity dependency-audit bundle.

## Architecture

```text
module definitions + formulas + presets
                 │
                 ▼
         FormulaRegistry
                 │
user values → validation → fixed-point solver
                 │
                 ▼
     values + steps + errors + diagrams
                 │
                 ▼
       Zustand store → React UI
```

- `src/core/` — framework-independent solver, validation, units, and types
- `src/modules/carnot/` — Carnot variables, formulas, preset, and diagram adapter
- `src/modules/diesel/` — ideal air-standard Diesel variables, formulas, preset, and diagram adapter
- `src/modules/otto/` — ideal air-standard Otto variables, formulas, preset, and diagram adapter
- `src/store/` — UI/solver integration and unit boundary
- `src/components/` — responsive inputs, results, diagrams, and derivation UI
- `tests/` — unit, property-based, robustness, store, and component regression tests
- `docs/` — architecture, decisions, and testing guidance

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [src/modules/carnot/README.md](src/modules/carnot/README.md), [src/modules/diesel/README.md](src/modules/diesel/README.md), and [src/modules/otto/README.md](src/modules/otto/README.md) for details.

## For coding agents and contributors

Start with [`AGENTS.md`](AGENTS.md), then follow [`docs/TESTING.md`](docs/TESTING.md). They define the repository boundaries, decision rules, test strategy, prohibited shortcuts, and required verification evidence without depending on a specific coding-agent product. Supply-chain controls and their limits are documented in [`SECURITY_NOTES.md`](SECURITY_NOTES.md).

## Model limits

- Ideal gas only
- Constant isentropic exponent $\kappa$
- Fixed-point solver handles formulas with exactly one unknown, not arbitrary implicit systems
- Absolute entropy uses a documented reference state
- The tool is an educational calculation aid, not a substitute for validating the assumptions in the original task

## Deployment

Pushes to `main` deploy the production build to GitHub Pages via `.github/workflows/deploy-pages.yml`.
The Vite build uses relative asset paths so the app works below a repository-specific Pages path.

## License

Licensed under the [MIT License](LICENSE).

## Joule / Brayton

The calculator includes a static ideal four-state Joule/Brayton module with an inspectable reference preset, component work, heat balances, efficiency, back-work ratio, and p-v/T-s diagrams. It intentionally excludes staging, recuperation, losses, and optimisation.