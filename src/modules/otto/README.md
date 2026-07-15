# Otto Process Module

## Scope

This module models the ideal air-standard Otto cycle with constant specific heats and a constant isentropic exponent. It is a deterministic teaching model, not a simulation of a real spark-ignition engine.

## Process topology

1. `1 → 2`: reversible adiabatic compression
2. `2 → 3`: isochoric heat addition
3. `3 → 4`: reversible adiabatic expansion
4. `4 → 1`: isochoric heat rejection

## Valid domain

- `T > 0`, `p > 0`, `v > 0`
- `kappa > 1`
- compression ratio `r > 1`
- heat-addition state `T3 > T2`

## Sign convention

- `q_in > 0`: heat enters the working gas
- `q_out < 0`: heat leaves the working gas
- `w_netto < 0`: net work output from the engine

## Reference-air preset

`T1 = 300 K`, `p1 = 100 kPa`, `r = 10`, `T3 = 1800 K`, `kappa = 1.4`, and `Rs = 287 J/(kg·K)`.

The expected thermal efficiency is approximately `60.19 %`.

Entropy is reported relative to the documented ideal-gas reference state $T_\mathrm{ref}=273.15\,\mathrm{K}$ and $p_\mathrm{ref}=101325\,\mathrm{Pa}$; it is intended for state comparison and diagrams in this model, not a calibrated material-property datum.

## Non-goals

No combustion chemistry, fuel properties, variable heat capacities, heat losses, pumping losses, valve timing, ignition timing, emissions, or mechanical losses are represented.
