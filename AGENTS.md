# Engineering Agent Guide

## Product boundary

This repository is a deterministic browser calculator, not an AI calculation service.
Preserve the core promise: the same physical inputs produce the same outputs and every derived value has an inspectable formula path.

## Read order

1. `docs/plans/ACTIVE.md` — current work and blockers
2. `src/modules/<module>/TASKS.md` — module backlog
3. `src/modules/<module>/README.md` — domain conventions and limits
4. `docs/ARCHITECTURE.md` — system boundaries
5. `docs/DECISIONS.md` — architectural rationale
6. `src/core/types.ts` — interface source of truth
7. nearest source and tests

## Work loop

1. Recon before mutation: identify whether the boundary is dependency, build, core logic, units, UI, diagram rendering, or deployment.
2. State the smallest testable requirement.
3. Add a failing regression or behavior test before production code.
4. Implement the smallest coherent slice.
5. Run the targeted test, then the full quality bundle.
6. Inspect user-visible behavior in a real browser for UI or diagram changes.
7. Update module docs and `docs/QUALITY.md` when behavior or evidence changes.

## Quality bundle

```bash
npm test
npm run lint
npm run build
npm audit
```

Do not claim release readiness unless all four checks were executed or the blocker is explicit.

## Domain invariants

- Internally use SI units; convert only at the input/output boundary.
- Define every variable in `src/core/types.ts` and module `config.ts`.
- Each formula must provide `solveFor` and `latexSteps` for every supported target.
- Validate computed values as well as user inputs.
- Carnot convention: 1→2 adiabatic compression, 2→3 hot isothermal expansion, 3→4 adiabatic expansion, 4→1 cold isothermal compression.
- Carnot temperatures: `T1 = T4 = T_cold`, `T2 = T3 = T_hot`.
- Sign convention: `q_in > 0`, `q_out < 0`, `w_netto < 0` for work output.
- Keep diagrams module-independent through `DiagramSpec` adapters.

## UI rules

- German UI; English code and durable engineering docs.
- Minimum 44 px interactive targets on mobile.
- Numeric values must preserve significant integer zeros.
- Computed and user-entered values need visually distinct status.
- Do not hide assumptions or model limits.
- Verify at desktop and an iPhone-class width after responsive changes.

## Repository hygiene

- Do not commit `node_modules`, `dist`, personal `USER.md`, or legacy local agent configuration.
- Use `npm ci` for reproducible dependency restoration.
- Do not commit secrets.
- Do not push or deploy without explicit user approval.
