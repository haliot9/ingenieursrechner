# Joule / Brayton module

Static deterministic educational model of the ideal four-state Joule/Brayton heat-engine cycle.

## Topology and signs

1->2 is isentropic compression, 2->3 is isobaric heat input, 3->4 is isentropic expansion, and 4->1 is isobaric heat rejection.

The repository convention is preserved: q_in > 0, q_out < 0, w_comp > 0, w_turb < 0, and w_netto < 0. The module exposes the dimensionless back_work_ratio.

## Assumptions and non-goals

Ideal gas with constant Rs, cp, cv, and kappa. The module validates the heat-engine domain. It does not implement dynamic stages, intercooling, reheat, recuperation, losses, variable heat capacities, sweeps, optimisation, heatmaps, or finite-optimum claims.