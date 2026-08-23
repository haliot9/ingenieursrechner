# Derivation Architecture

## Purpose and status

This document defines how a calculator module turns arbitrary supported user facts into deterministic numerical results and an inspectable learner-facing proof. It is the authority for identity, ownership, route planning, proof composition, failure behaviour, and coverage.

The document deliberately distinguishes three states:

- **Current:** behaviour implemented in the repository today.
- **Phase A contract:** behaviour required to generalise the four existing fixed-topology ideal-cycle modules.
- **Future seam:** compatibility rules for later configurable topologies and state-dependent property models; these are not current implementation scope.

The repository is a deterministic browser calculator, not an unrestricted computer algebra system and not a catalogue of complete exercise scenarios.

## Core idea: finite local authority, generated global route

A module using planned execution does not enumerate every possible set of user inputs. It declares a finite set of quantities and approved target-specific relation directions. User facts are start nodes. Each direction is a directed hyperedge from all required facts to one target fact. The planner repeatedly follows reachable directions and selects a deterministic route.

Under the Phase A contract, the explanation is attached to an approved direction or declared composite route, not to a complete input scenario. The current reference-only Joule composer has not yet implemented that general attachment.

```text
module quantities + relations + direction policies + proof authority
                              │
                              ▼
user values ──> KnownFact[] ──> ReachabilityPlan
                                      │
                                      ▼
                     selected directions + blocked routes
                                      │
                                      ▼
                       numerical execution + validation
                                      │
                                      ▼
                  SolverResult + SolutionStep provenance
                                      │
                                      ▼
                   proof composition from selected evidence
                         │                         │
                         ▼                         ▼
               Calculation Story       unconsumed evidence
                         │                         │
                         └───────────┬─────────────┘
                                     ▼
                              truthful rendering
```

Current planned execution generates concrete values, reachable quantities, route order, and missing-fact diagnostics for each run. Phase A additionally generates substitutions and reused proof-node applications from finite, reviewable physical relations, supported directions, model conditions, route policy, and pedagogical proof authority.

## Identity hierarchy

Identifiers carry different meanings and must not be conflated.

```text
moduleId
├── quantityId
├── formulaId
│   └── directionId = formulaId:targetId
│       ├── required quantityIds
│       ├── mode, conditions, and route priority
│       └── proofRecipeId                 Phase A contract
├── validationRelationId
├── story section / chain / row IDs       presentation only
├── diagram state / segment IDs           projection only
└── componentInstanceId                   future seam
    └── relationApplicationId             future seam
```

| Identity | Meaning | Current representation | Rule |
|---|---|---|---|
| `moduleId` | Closed calculation domain | `CalculatorModule.id` | Selects module authority; never a UI branch for core behaviour. |
| `quantityId` | Semantic fact such as `T2`, `cp`, or `q_in` | `Variable.id` | Core treats it as opaque. It must not parse numeric suffixes or infer physics from the name. |
| `formulaId` | Registered physical/numerical relation | `Formula.id` | Stable within a module. It identifies the governing relation, not a rendered row. |
| `targetId` | Quantity produced by one direction | key of `Formula.solveFor` | Must be a declared module quantity and must not occur in its own expression dependencies. |
| `directionId` | One approved calculation direction | `${formulaId}:${targetId}` | Primary identity shared by planning, execution, provenance, validation, and proof coverage. |
| condition ID | Domain or model precondition | `DomainCondition.id` | Evaluates to satisfied, unsatisfied, or unknown; never silently assumed. |
| `validationRelationId` | Stable identity for a cross-quantity check or contradiction | Partial current support through `DiagnosticRelation.id` and formula IDs; `validateValues` errors do not always expose one | Phase A requires a stable module-owned identity for every validation result consumed by proof or presentation. |
| `proofRecipeId` | Approved derivation authority for a direction or declared composite route | Phase A contract; Joule currently has a family inventory | May reuse bounded algebra operations, but cannot grant a new numerical route. |
| `proofNodeId` | One concrete proof application in a run | Phase A contract | Distinct from the reusable recipe so repeated applications remain separate. |
| story row/chain/section ID | Presentation and local focus identity | `CalculationStoryRow` and `CalculationStorySection` IDs | Must not be used as solver, formula, or physical identity. |
| diagram state/segment ID | Projection identity | `DiagramStatePoint.id`, segment endpoints | Must refer to module states without becoming proof authority. |
| `componentInstanceId` | One repeated physical component | Future seam | Two reheaters may share a relation template but require distinct component and proof applications. |

Today a static module's `formulaId` often acts as both relation-template and relation-application identity. A future topology compiler must split those roles; Phase A must not introduce code that prevents that split.

## Ownership boundaries

### Core owns mechanism

Core code may:

- compile registered `solveFor` expressions into directions;
- calculate dependencies from the expression AST;
- compute reachability and detect predecessor cycles;
- apply deterministic route comparison;
- execute the selected finite directions;
- preserve immutable user facts;
- record source quantities and source step indexes;
- match consumed story identities to solver provenance; Phase A reconciliation must reject invented, duplicate, or unsupported consumption;
- expose and validate structured proof state without interpreting physical names.

Core code must not:

- infer thermodynamic meaning from `T2`, `p4`, or a module name;
- invent a physical relation or teaching route;
- silently choose a domain assumption;
- rewrite user facts to make a route succeed;
- present a property lookup or numerical block as an algebraic identity;
- infer arrow semantics from arbitrary LaTeX text.

### Modules own authority

A module owns the finite knowledge needed to solve and explain its model:

1. quantities, symbols, SI units, display units, groups, and local constraints;
2. governing physical relations;
3. supported target-specific `solveFor` expressions;
4. direction modes: `derive`, `validate-only`, or `disabled`;
5. domain conditions and model assumptions;
6. deterministic route priorities and permitted alternatives;
7. post-solve relationship validation;
8. proof recipes and reusable physical foundations;
9. narrative context and process ordering;
10. diagram projection and visible model limits.

A generic algebra layer may execute or verify a declared transformation. It may not decide which physical relations belong to a module or which route is pedagogically primary.

### Renderer owns presentation

The renderer receives structured equations, operations, states, and disclosure roles. It may lay them out responsively and render KaTeX. It must not repair, simplify, reinterpret, or reverse an operation supplied by the proof layer.

## Runtime data flow

### 1. Input normalisation and validation

The store converts user values to canonical SI units and marks them as immutable user facts. All paths validate input constraints before solving and target constraints before accepting each derived value. Planned Joule execution also runs relationship validation while accepting derived targets; legacy modules run their module-level relationship validation after the fixed-point solve.

### 2. Direction compilation

`compileSolveDirections()` converts each registered `solveFor` target into a `SolveDirection`:

```text
formulaId + targetId + expression
        ↓ AST symbol collection
directionId + requiredIds + policy
```

Unknown symbols and self-references are errors. Direction policy can add preconditions, route priority, source reference, or change the mode from `derive` to validation-only or disabled.

### 3. Reachability planning

`planDerivations()` starts from known fact IDs and repeatedly selects directions whose required facts are reachable and whose preconditions are satisfied. It rejects predecessor cycles, chooses one deterministic primary direction per target, retains only a bounded set of alternatives, and reports blocked targets with missing facts.

Planner order answers **what can be derived and which approved route wins**. It does not itself author algebra or narrative text.

### 4. Numerical execution and provenance

The planned solver executes only selected directions. Before accepting a result it checks:

- all declared inputs are available;
- the evaluated result is finite;
- target constraints pass;
- module post-validation passes.

Every accepted `SolutionStep` records its `formulaId`, target, required source quantities, indexes of earlier derived source steps, and raw execution index. Validate-only directions and redundant user facts may report contradictions, but they never create or overwrite a user value.

### 5. Proof composition

The Phase A proof composer must consume the selected route and accepted `SolutionStep` evidence. It may:

- instantiate the approved recipe for each selected direction;
- reuse an already proven foundation without repeating it;
- topologically order proof applications from their actual dependencies;
- attach module-owned narrative context;
- expose bounded approved alternatives;
- retain checks separately from primary derivations.

It must reject or fall back when a recipe lacks the required solver provenance, conditions, values, or source facts. A correct number does not authorise an unsupported explanation.

### 6. Story and residual evidence coexistence

Story composition is optional presentation over accepted solver state, never a second solver. Its failure must not mutate or invalidate accepted numerical results.

The target behaviour distinguishes:

- **complete:** every selected primary step in the visible route is truthfully consumed;
- **partial:** an approved subset is narrated and all unconsumed primary steps, alternatives, blocked facts, and contradictions remain visible in their generic evidence surface;
- **not applicable:** the module or route has no story authority, so generic evidence remains authoritative;
- **unavailable:** composition failed despite an otherwise supported route; the reason and all generic evidence remain visible.

Current limitation: the public `CalculationStoryState` has no explicit partial mode, and the application hides generic evidence whenever a complete or unavailable story is displayed. Phase A must correct that coexistence before partial free-input stories can be trusted.

## Supported input behaviour

"Works for arbitrary inputs" has a bounded, testable meaning within each module's declared ideal model.

| Input state | Required behaviour |
|---|---|
| Uniquely reachable | Derive every reachable quantity through approved directions and show a complete or truthful partial proof. |
| Insufficient | Preserve all reachable results, report blocked targets and the smallest useful missing-fact guidance, and never invent values. |
| Redundant and consistent | Keep every user fact immutable, validate the redundant relationships, and derive only missing quantities. |
| Contradictory, domain-invalid, or ambiguous | Localise the relation/quantity/condition that prevents a safe result; do not choose a branch or assumption silently. |

The product promises one deterministic approved primary teaching route and a bounded number of useful alternatives. It does not promise every mathematically equivalent proof tree.

## Bounded algebra synthesis

The runtime numerical planner uses only explicitly registered directions. Proof construction may reuse a bounded set of typed operations, for example:

- equate or swap equivalent sides;
- add, subtract, multiply, or divide both sides with recorded domain conditions;
- substitute a declared equality;
- factor or collect a declared symbol;
- exponentiate, take a root, or apply a logarithm with explicit branch/domain conditions;
- reuse a previously proven fact.

Unrestricted `simplify()` output, arbitrary equation-system elimination, or opaque CAS prose is not learner-facing authority.

Cross-relation substitution requires an explicitly declared composite direction or composite proof recipe. The algebra layer may build or verify its microsteps after the module has authorised the route; it may not discover and activate the physical route on its own.

### Example: direct `cp` from `Rs` and `kappa`

The current Joule module derives:

```text
Rs + kappa -> cv
kappa + cv -> cp
```

It cannot currently select or present the direct alternative as a first-class route

```text
R_s = c_p - c_v
c_v = c_p / kappa
R_s = c_p - c_p / kappa
c_p = R_s kappa / (kappa - 1)
```

To support that path, the module must authorise a composite direction such as `cp_from_Rs_kappa:cp`, declare `Rs` and `kappa` as dependencies, require `kappa > 1` in the calorically perfect ideal-gas model, and attach a proof recipe consuming the Mayer relation and kappa definition. The existing two-step route may remain primary while the direct isolation is exposed as an approved alternative.

This is one finite relation-family direction, not one record per complete input scenario.

## Reuse across the four current cycles

The four modules share a calculation and proof grammar, not identical cycle content.

Reusable physical/proof families include:

- ideal-gas state relations;
- calorically perfect material closure;
- relative-entropy evaluation;
- isentropic equality and state-change foundations;
- steady component or closed-system energy balances;
- cycle energy balance and efficiency;
- substitution, reuse, validation, and unit proofs.

Module-owned process families remain distinct:

- Joule: isobaric heat addition and rejection with `cp`;
- Otto: isochoric heat addition and rejection with `cv`;
- Diesel: isobaric addition with `cp`, isochoric rejection with `cv`, and cutoff-ratio relations;
- Carnot: isothermal heat transfer using logarithmic volume ratios plus a broader density and extensive-volume model.

Do not copy an entire Joule story into other modules. Generalise Joule first, migrate Otto second, and extract only the relation/proof templates proven identical by those two implementations. Diesel can then reuse and extend those templates. Carnot should reuse the core grammar while retaining its isothermal relation families.

## Diagram and topology boundary

Numerical solving, proof composition, and diagram rendering consume related state but remain separate projections. A diagram adapter receives accepted values and emits `DiagramSpec`; the generic renderer does not inspect solver directions or module IDs.

Phase A keeps four-state module topology explicit. Shared core and proof code must nevertheless treat quantity IDs and diagram state IDs as opaque and must not assume exactly four states.

The future evolution is **static now, compiler later**:

```text
constrained component configuration
              ↓
module-local topology compiler
              ↓
quantities + relation applications + directions + validation
          + diagram spec + proof-recipe applications
              ↓
existing planner / solver / proof / renderer contracts
```

Repeated components require a relation-template identity separate from each component and relation application. Coupled recuperators or branch-flow cycles may later require a jointly solved numerical-block evidence node. They must not be disguised as a chain of explicit one-unknown directions.

A future property provider is orthogonal to topology. Equation-of-state, table, interpolation, or flash results must enter the proof graph as property evidence with medium, formulation, backend/version, input pair, phase/region, validity, and warnings—not as fabricated algebra.

## Coverage and reconciliation gates

Coverage is layered; the repository must not enumerate all `2^N` input-presence subsets.

### Static inventory

- every quantity, formula, direction, condition, recipe, and application ID is unique in its scope;
- every expression symbol is a declared quantity or permitted function;
- every active direction resolves to reviewed default or explicit policy and has valid dependencies;
- every story-authorised direction has proof authority;
- no recipe grants a direction absent from numerical authority;
- presentation-only identities never act as solver identity.

### Relation and direction tests

- every supported direction is checked against an independent numerical oracle;
- every rearrangement and proof sequence preserves the governing relation under its conditions;
- substitutions, units, signs, and KaTeX operations are target-specific;
- small finite relation families, such as the six two-property combinations of `Rs`, `kappa`, `cp`, and `cv`, are exhaustively covered.

### Route and metamorphic tests

- representative forward, inverse, alternative, blocked, validate-only, and contradiction topologies are covered;
- physically valid full states are generated and different solvable fact subsets are masked;
- equivalent valid input sets converge to the same physical state;
- input and formula registration order do not change the deterministic primary route;
- adding consistent user facts does not change accepted values;
- perturbing one redundant fact produces a localised contradiction;
- user facts are never overwritten.

### Proof and presentation tests

- every displayed primary proof node has matching selected solver provenance;
- consumed directions exactly match what the story claims to explain;
- unconsumed primary steps, blocked facts, alternatives, and contradictions remain visible;
- unsupported or unavailable stories fall back without changing solver state;
- structured operation kinds and arrows are asserted rather than inferred from rendered strings;
- desktop, mobile-width, keyboard, overflow, and KaTeX behaviour are checked for visible changes.

## Extension checklist

Before activating a new relation, direction, module, or future component instance, verify:

1. What semantic quantities and units does it own?
2. What physical relation and model assumptions justify it?
3. Which target directions are derive, validate-only, or disabled?
4. What conditions and branch rules apply?
5. Which route is primary and which alternatives are worth teaching?
6. What numerical oracle validates every active direction?
7. What proof recipe and reusable foundations explain it?
8. What validations catch redundant contradictions?
9. How does it project into narrative context and diagrams?
10. Which reconciliation tests fail if any dependency is omitted?

Adding a formula without its policy, proof coverage, validation, and affected projection evidence is incomplete work.

## Current implementation map

### Implemented now

- module variables and pre-solved `Formula.solveFor` expressions;
- generic legacy fixed-point solving for Carnot, Diesel, and Otto;
- compiled directions, reachability planning, selected execution, immutable user facts, and provenance for Joule;
- Joule direction policy with 44 derive directions and four validate-only ideal-gas `Rs` checks;
- generic presentation plans, diagrams, and calculation-story data/rendering seams;
- one hand-authored full Joule story for the exact approved six-input reference case.

### Required for Phase A

- complete material-property direction and validation authority;
- provenance/recipe reconciliation independent of the reference preset;
- bounded proof composition from selected directions;
- truthful partial-story and generic-evidence coexistence;
- arbitrary supported Joule input values and routes;
- sequential migration and template extraction for Otto, Diesel, and Carnot;
- the coverage gates defined above.

### Explicitly deferred

- free-form component or topology editing;
- configurable intercooling, reheating, or recuperation;
- a general implicit/nonlinear equation-system solver;
- medium database, CoolProp/IAPWS runtime, phase equilibrium, and mixtures;
- variable-property integration;
- Rankine and refrigeration modules;
- displaying every mathematically equivalent derivation.

## Code and evidence entry points

- Core identities: [`src/core/types.ts`](../src/core/types.ts)
- Direction compilation: [`src/core/solve-directions.ts`](../src/core/solve-directions.ts)
- Reachability planning: [`src/core/derivation-planner.ts`](../src/core/derivation-planner.ts)
- Planned execution and provenance: [`src/core/solver.ts`](../src/core/solver.ts)
- Story contract: [`src/core/calculation-story.ts`](../src/core/calculation-story.ts)
- Joule policy: [`src/modules/joule/config.ts`](../src/modules/joule/config.ts)
- Joule formulas and current presentation metadata: [`src/modules/joule/formulas.ts`](../src/modules/joule/formulas.ts)
- Joule finite story-family inventory: [`src/modules/joule/calculation-story-recipes.ts`](../src/modules/joule/calculation-story-recipes.ts)
- Current reference-only composer: [`src/modules/joule/calculation-story.ts`](../src/modules/joule/calculation-story.ts)
- Testing doctrine: [`docs/TESTING.md`](TESTING.md)
- Current Joule story contract: [`docs/CALCULATION_STORY_PILOT.md`](CALCULATION_STORY_PILOT.md)
