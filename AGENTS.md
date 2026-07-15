# Engineering Agent Guide

## Product boundary

This repository is a deterministic browser calculator, not an AI calculation service.
Preserve the core promise: the same physical inputs produce the same outputs and every derived value has an inspectable formula path.

## Read order

1. `src/modules/<module>/README.md` — domain conventions and limits
2. `docs/ARCHITECTURE.md` — system boundaries
3. `docs/DECISIONS.md` — architectural rationale
4. `src/core/types.ts` — interface source of truth
5. nearest source and tests

## Work loop

1. Recon before mutation: identify whether the boundary is dependency, build, core logic, units, UI, diagram rendering, or deployment.
2. State the smallest observable requirement and the most relevant failure mode.
3. Add a failing regression or behavior test before production code and confirm it fails for the intended reason.
4. Implement the smallest coherent slice.
5. Run the targeted test, then the full quality bundle.
6. Inspect user-visible behavior in a real browser for UI or diagram changes.
7. Review the diff for unintended scope and update affected quality evidence.
8. Report what is verified, untested, or blocked; never convert assumptions into completion claims.

Follow [`docs/TESTING.md`](docs/TESTING.md) for test selection, independent oracles, numerical tolerances, property tests, browser evidence, and anti-gaming rules.

## Decision rules

- Prefer existing module patterns and utilities over parallel machinery.
- Test behavior at the lowest layer that can prove the requirement.
- Treat generated output, subagent reports, and passing snapshots as claims until independently verified.
- Stop and expose ambiguity when requirements, domain conventions, or expected values are missing.
- Do not broaden scope during a fix; record unrelated findings separately.
- A large test count, coverage percentage, or green build is evidence only for the behavior it actually exercises.

## Quality bundle

```bash
npm run verify
```

This runs:

```bash
npm test
npm run lint
npm run build
npm audit --audit-level=high
```

Do not claim release readiness unless the complete bundle was executed successfully or the blocker is explicit.

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
- Treat dependency and lockfile changes as executable supply-chain changes requiring review.
- Pin GitHub Actions to full commit SHAs and keep workflow permissions job-scoped and minimal.
- Do not add repository secrets or self-hosted runners to pull-request verification.
- Do not commit secrets.
- Do not push or deploy without explicit user approval.
