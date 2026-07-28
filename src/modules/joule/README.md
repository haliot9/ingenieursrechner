# Joule / Brayton module

Static deterministic educational model of the ideal four-state Joule/Brayton heat-engine cycle.

## Topology and signs

1->2 is isentropic compression, 2->3 is isobaric heat input, 3->4 is isentropic expansion, and 4->1 is isobaric heat rejection.

The repository convention is preserved: q_in > 0, q_out < 0, w_comp > 0, w_turb < 0, and w_netto < 0. The module exposes the dimensionless back_work_ratio.

## Assumptions and non-goals

Ideal gas with constant Rs, cp, cv, and kappa. The module validates the heat-engine domain. It does not implement dynamic stages, intercooling, reheat, recuperation, losses, variable heat capacities, sweeps, optimisation, heatmaps, or finite-optimum claims.

## Bounded calculation-story pilot

The module owns a finite learner-facing pilot for `R_s + kappa -> c_v -> c_p` and direct `c_v + kappa -> c_p`. It is presentation-only: a complete story declares the exact consumed `cv`/`cp` solver directions, renders the continuous proof once, and filters only those matching primary cards. The remaining `PresentationPlan`, including alternatives, blocked relations, and contradictions, stays in the legacy derivation surface.

On narrow screens, each equation uses a labelled local horizontal scroller so a long expression can move without widening the document. See [CALCULATION_STORY_PILOT.md](../../../docs/CALCULATION_STORY_PILOT.md) for the bounded routes and evidence contract.
