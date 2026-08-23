# Testing and Verification Doctrine

## Purpose

Tests provide evidence that the calculator is physically valid, deterministic, explainable, and safe to change. A green suite is not proof by itself: every test must protect a requirement, invariant, regression, or user-visible contract.

## Change workflow

For every behavioral change:

1. Identify the affected boundary: formula, solver, validation, units, store, component, diagram, build, or deployment.
2. State the smallest observable requirement and the important failure mode.
3. Add or identify a test that fails for the intended reason.
4. Confirm that failure before changing production code.
5. Implement the smallest coherent correction.
6. Run the targeted test, then the complete verification bundle.
7. Use a real browser when user-visible behavior changed.
8. Report executed evidence and anything left unverified.

A defect is not verified as fixed unless its regression test failed against the defective behavior and passed after the correction.

## Choose the lowest useful test layer

| Layer | Proves |
|---|---|
| Formula | Every supported `solveFor` direction against independently calculated values |
| Solver/core | Chaining, termination, determinism, contradictions, insufficient data, constraints, and calculation steps |
| Property-based | Physical and mathematical invariants over meaningful generated states |
| Store/boundary | SI conversion, display-unit isolation, reset behavior, and module integration |
| Component | User-visible interaction and rendering contracts, not private React state |
| End-to-end | Critical journeys that require a real browser |

Do not replace a smaller deterministic test with a browser test when the smaller test proves the same requirement.

## Thermodynamic risk coverage

A calculation-logic change must consider the relevant items below:

- every supported rearrangement of the changed relation;
- minimum, maximum, near-zero, prohibited-zero, and non-finite values;
- sign conventions and reversed or degenerate cycles;
- redundant consistent and redundant contradictory inputs;
- canonical SI values versus display units;
- deterministic output independent of formula registration order;
- preservation of inspectable calculation steps.

Use risk to select cases. Do not inflate the suite with combinations that prove nothing new.

## Expected values and numerical tolerances

Expected values must not be produced by the same production function under test.

Critical relations need at least one anchor from:

- a hand-calculated reference;
- a cited textbook or standard;
- an independently implemented oracle;
- an invariant that must hold independently of implementation.

Golden-state helpers may cover broad input combinations, but must remain anchored by independent reference cases.

Approximate assertions need a justified tolerance:

- prefer relative error for scale-dependent values;
- prefer absolute error near zero;
- do not loosen tolerances merely to make a test pass;
- document changes caused by floating-point propagation, conditioning, display rounding, or changed precision requirements.

## Property-based tests

Property tests express invariants rather than replaying examples with random numbers. Useful Carnot properties include:

- `0 < eta < 1` and `T_hot > T_cold`;
- `q_in > 0`, `q_out < 0`, and `w_netto < 0`;
- `w_netto = -(q_in + q_out)`;
- equivalent valid input sets converge to the same solved state;
- display-unit changes do not alter canonical SI values.

Generate physically meaningful states and minimize rejected cases. Preserve the failing seed and shrink path until the defect is understood.

## Regression policy

Every confirmed, automatable defect receives a regression test that:

- reproduces the smallest domain-level or user-visible failure;
- fails against the defective behavior;
- passes after the correction;
- remains in the suite;
- references the issue or failure-history entry when one exists.

Tests or assertions may be deleted or weakened only when the associated requirement intentionally changed and that change is documented.

## Assertion quality

Prefer assertions about numerical results, physical invariants, typed errors, contradiction reports, public interfaces, and user-visible behavior.

Avoid relying on:

- private component state or incidental DOM structure;
- implementation order unless it is part of the contract;
- snapshots as proof of mathematical correctness;
- only the absence of an exception;
- mocks that replace the behavior being tested.

## Landing evidence ownership

| Evidence | Owner and limit |
|---|---|
| Unit and DOM | The `unit` Vitest project owns pure logic and jsdom component contracts. It excludes every real child-process/file-watcher gate. |
| Process integration | The serial `process-gates` project owns exactly the six files listed below, with one worker and no file parallelism. |
| Browser | Playwright owns production-build journeys, real layout/WebGL/accessibility behavior, and its own preview process. |
| Comparator negative control | A copied trace or observation is altered to prove that a comparator rejects bad evidence. This does not mutate production. |
| Real-source mutation | One real production source is changed only in a fresh isolated copy; the unchanged owning test must RED once for the intended reason. |

## Browser verification

For relevant UI, responsive-layout, diagram, or formatting changes, inspect:

- a desktop viewport;
- a 390 × 844 mobile viewport;
- the reference-air journey;
- browser console errors and visible overflow;
- keyboard interaction and meaningful error presentation when affected.

Critical journeys should be automated with Playwright. Screenshots supplement automated assertions; they do not replace them.

Run the production browser journeys with:

```bash
npm run test:e2e
```

This builds the production application, enforces the initial-entry budget, and
runs Chromium at 1440 × 900 and 390 × 844 with one worker. The visual journeys
share a preview process plus browser animation/WebGL timing, so a parallel
local matrix is not canonical evidence. Playwright alone owns
`127.0.0.1:4173`: its preview command uses `--strictPort`,
`reuseExistingServer: false` locally and in CI, and bounded teardown. Do not
pre-start or reuse a preview server. The suite covers keyboard-only landing
navigation, Reduced Motion, failed Wright media, URL routing and browser Back,
light-theme control contrast, below-fold chunk deferral, and the real Joule
reference-air calculator journey. Install the pinned browser in a new
environment with `npx playwright install chromium`; CI uses `--with-deps`.

## Initial bundle budget

`npm run build` runs `npm run check:bundle` after Vite. The HTML entry's initial module scripts and module-preload graph may total at most 230 KiB minified and 75 KiB gzip. Route and below-fold chunks are excluded only when they are genuinely absent from the initial HTML graph; `e2e/performance.spec.ts` additionally confirms that the solver chunk is not requested at first paint.

## Required verification

The local test command is deliberately sequential:

```bash
npm run test:unit
npm run test:process-gates
# equivalent sequence, preceded by config freshness checks
npm test
```

`test:unit` is the canonical Vitest unit/DOM project. `test:process-gates` owns
exactly these six files from `vitest.config.ts`:

1. `tests/dev/config-hot-reload.test.ts`
2. `tests/dev/playwright-server-ownership.test.ts`
3. `tests/landing/background-config.test.ts`
4. `tests/landing/elastic-menu-chain-config.test.ts`
5. `tests/landing/line-field-config.test.ts`
6. `tests/landing/session3-evidence-finalizer.test.ts`

That project uses `fileParallelism: false` and `maxWorkers: 1`; do not move its
watchers, compilers, child processes, port ownership, or evidence finalizer into
the parallel unit pool. The Landing guide lists the subsystem routes:
[src/landing/README.md](../src/landing/README.md).

Run the narrowest relevant test first:

```bash
npm run test:unit -- <test-path>
```

Then run the complete local gate:

```bash
npm run verify
```

The gate comprises tests, lint, production build, and `audit:production`, which
runs `npm audit --omit=dev --audit-level=high`.

For a landing-page release, also run `npm run test:e2e`; it is enforced in both CI and the Pages release workflow.

## Manual Landing real-source mutation gate

No one-command mutation automation exists. The reviewed fallback below is
manual by design and must never edit the active checkout. Use one fresh copy per
mutant, then a fourth pristine copy.

### Mutants and fingerprints

The orchestration below applies each mutation only after its exact source
literal occurs once. Each mutant receives its own fresh copy and unchanged
owning test; any other failure shape is rejected.

| Mutant | Target and exact title | Required single-failure fingerprint |
|---|---|---|
| `chain` | `tests/landing/animated-content-chain.test.tsx` — `autonomously reverses in exact causal reverse order, rearms initial, and replays entry` | exit 1; expected call count 1 versus 0; stack in the target file |
| `profiles` | `tests/landing/thermodynamics-explorer.test.tsx` — `refreshes the same owned trigger once for real open, move, and close revisions` | exit 1; one deep-equality failure containing `power3.out` and `bounce.out`; target-file stack |
| `diagram` | `tests/landing/thermodynamics-explorer.test.tsx` — `opens authentic registry detail and a real reference T-s diagram without routing the row` | exit 1; one `Object.is equality` failure at diagram identity; target-file stack; do not require compacted object keys |

### Complete four-copy orchestration

The table above exposes every target and fingerprint for review. Run this
self-contained orchestration from the active
repository root. It creates three separate mutant copies and a fourth pristine
copy, runs the active GREEN outside the checkout, compares the final active
manifest, and validates every temporary root before cleanup. It requires POSIX
process groups (macOS, Linux, or WSL) and refuses to spawn Vitest on native
Windows. A normal close returns immediately; after a timeout, cleanup remains
blocked until TERM/KILL escalation has completed and the process group is
confirmed absent. Any failed guard exits non-zero; this is a documented manual
command, not a package runner.

```bash
set -euo pipefail
LANDING_ACTIVE_ROOT="$(git rev-parse --show-toplevel)"
LANDING_NODE_BIN="$(command -v node)"
export LANDING_ACTIVE_ROOT LANDING_NODE_BIN

"$LANDING_NODE_BIN" --input-type=module <<'NODE'
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, sep } from 'node:path'

const activeRoot = await realpath(process.env.LANDING_ACTIVE_ROOT)
const nodeBin = process.env.LANDING_NODE_BIN
const temporaryParent = await realpath(tmpdir())
if (process.platform === 'win32') {
  throw new Error('manual mutation gate requires POSIX process groups; use macOS, Linux, or WSL')
}
const excluded = new Set([
  '.git', 'node_modules', 'dist', 'dist-ssr', 'output', '.superpowers',
  'playwright-report', 'test-results', 'coverage', '.vitest-reports',
])
const manifest = [
  'src/landing/components/AnimatedContentChain.tsx',
  'src/landing/components/ThermodynamicsExplorer.tsx',
  'tests/landing/animated-content-chain.test.tsx',
  'tests/landing/thermodynamics-explorer.test.tsx',
]
const mutants = [
  {
    name: 'chain',
    target: 'tests/landing/animated-content-chain.test.tsx',
    title: 'autonomously reverses in exact causal reverse order, rearms initial, and replays entry',
    fragments: ['called 1 times', 'got 0 times'],
  },
  {
    name: 'profiles',
    target: 'tests/landing/thermodynamics-explorer.test.tsx',
    title: 'refreshes the same owned trigger once for real open, move, and close revisions',
    fragments: ['power3.out', 'bounce.out'],
  },
  {
    name: 'diagram',
    target: 'tests/landing/thermodynamics-explorer.test.tsx',
    title: 'opens authentic registry detail and a real reference T-s diagram without routing the row',
    fragments: ['Object.is equality'],
  },
]
const temporaryRoots = []
const unconfirmedTimeoutGroups = new Set()
const infrastructureReporterSource = [
  "import { writeFile } from 'node:fs/promises'",
  'export default class LandingInfrastructureReporter {',
  '  async onTestRunEnd(_modules, unhandledErrors, reason) {',
  '    const errors = unhandledErrors.map(error => ({',
  "      name: error?.name ?? 'Error',",
  "      message: error?.message ?? String(error),",
  "      stack: error?.stack ?? '',",
  '    }))',
  "    await writeFile(process.env.LANDING_INFRA_REPORT, JSON.stringify({ reason, errors }))",
  '  }',
  '}',
].join('\n')

const sha256 = async file => createHash('sha256').update(await readFile(file)).digest('hex')
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const hashManifest = async root => Object.fromEntries(await Promise.all(
  manifest.map(async file => [file, await sha256(join(root, file))]),
))
const requireSameManifest = (expected, actual, owner) => {
  for (const file of manifest) {
    if (expected[file] !== actual[file]) throw new Error(`${owner} changed ${file}`)
  }
}
const once = (text, needle) => {
  if (text.split(needle).length !== 2) throw new Error(`expected one literal: ${needle}`)
}

async function makeCopy(label, activeManifest) {
  const root = await mkdtemp(join(temporaryParent, `landing-mutation-${label}.`))
  temporaryRoots.push(root)
  const copyRoot = join(root, 'repo')
  const reporterFile = join(root, 'infrastructure-reporter.mjs')
  await cp(activeRoot, copyRoot, {
    recursive: true,
    filter(source) {
      const path = relative(activeRoot, source)
      return path === '' || !excluded.has(path.split(sep)[0])
    },
  })
  await symlink(join(activeRoot, 'node_modules'), join(copyRoot, 'node_modules'), 'dir')
  await writeFile(reporterFile, infrastructureReporterSource)
  requireSameManifest(activeManifest, await hashManifest(copyRoot), `${label} PRE copy`)
  return { root, copyRoot, reporterFile }
}

async function applyMutant(copyRoot, name) {
  const chain = join(copyRoot, 'src/landing/components/AnimatedContentChain.tsx')
  const explorer = join(copyRoot, 'src/landing/components/ThermodynamicsExplorer.tsx')
  if (name === 'chain') {
    const before = `      }, [], finalCompletionAt)\n      ownedScheduler.play()\n    }\n\n    const exitDownward = () => {`
    const after = `      }, [], finalCompletionAt)\n    }\n\n    const exitDownward = () => {`
    const text = await readFile(chain, 'utf8'); once(text, before)
    await writeFile(chain, text.replace(before, after))
  } else if (name === 'profiles') {
    let text = await readFile(explorer, 'utf8')
    once(text, 'profiles.lead'); once(text, 'profiles.follower')
    if (text.includes('__LANDING_LEAD__')) throw new Error('reserved swap token exists')
    text = text.replace('profiles.lead', '__LANDING_LEAD__')
      .replace('profiles.follower', 'profiles.lead')
      .replace('__LANDING_LEAD__', 'profiles.follower')
    await writeFile(explorer, text)
  } else if (name === 'diagram') {
    const before = '<LandingDiagram spec={referenceScenario.diagramSpec} />'
    const after = '<LandingDiagram spec={{ ...referenceScenario.diagramSpec, statePoints: referenceScenario.diagramSpec.statePoints.slice(0, 3) }} />'
    const text = await readFile(explorer, 'utf8'); once(text, before)
    await writeFile(explorer, text.replace(before, after))
  } else throw new Error(`unknown mutant ${name}`)
}

async function waitForGroupExit(pgid) {
  const deadline = Date.now() + 5_000
  while (true) {
    try {
      process.kill(-pgid, 0)
    } catch (error) {
      if (error?.code === 'ESRCH') return
      throw error
    }
    if (Date.now() >= deadline) {
      throw new Error(`process group ${pgid} survived SIGKILL; temporary roots retained`)
    }
    await delay(50)
  }
}

async function runVitest(root, targets, titlePattern, outputFile, reporterFile, expectedExit) {
  await mkdir(dirname(outputFile), { recursive: true })
  const infrastructureFile = `${outputFile}.infrastructure.json`
  const args = [
    join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--project', 'unit',
    ...targets, '-t', titlePattern, '--no-cache', '--no-file-parallelism',
    '--maxWorkers=1', '--reporter=json', `--reporter=${reporterFile}`,
    `--outputFile.json=${outputFile}`,
  ]
  const child = spawn(nodeBin, args, {
    cwd: root,
    detached: true,
    env: {
      CI: '1',
      NODE_ENV: 'test',
      LANDING_INFRA_REPORT: infrastructureFile,
      PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
    },
    stdio: 'inherit',
  })
  const closed = new Promise(resolve => {
    child.once('error', error => resolve({ error }))
    child.once('close', (code, signal) => resolve({ code, signal }))
  })
  const pgid = child.pid
  if (!Number.isInteger(pgid)) {
    const outcome = await closed
    if (outcome.error) throw outcome.error
    throw new Error('Vitest process group id unavailable')
  }
  let timeout
  const first = await Promise.race([
    closed.then(outcome => ({ kind: 'closed', outcome })),
    new Promise(resolve => {
      timeout = setTimeout(() => resolve({ kind: 'timeout' }), 45_000)
    }),
  ])
  const timedOut = first.kind === 'timeout'
  let outcome
  if (!timedOut) {
    clearTimeout(timeout)
    outcome = first.outcome
  } else {
    unconfirmedTimeoutGroups.add(pgid)
    let escalationError
    const attemptTermination = signal => {
      try {
        process.kill(-pgid, signal)
      } catch (error) {
        if (error?.code !== 'ESRCH' && !escalationError) escalationError = error
      }
    }
    attemptTermination('SIGTERM')
    await delay(1_000)
    attemptTermination('SIGKILL')
    outcome = await closed
    await waitForGroupExit(pgid)
    unconfirmedTimeoutGroups.delete(pgid)
    if (escalationError) throw escalationError
  }
  if (outcome.error) throw outcome.error
  if (timedOut || outcome.signal || outcome.code !== expectedExit) {
    throw new Error(`Vitest exit mismatch: code=${outcome.code} signal=${outcome.signal} timeout=${timedOut}`)
  }
  return {
    report: JSON.parse(await readFile(outputFile, 'utf8')),
    infrastructure: JSON.parse(await readFile(infrastructureFile, 'utf8')),
  }
}

const assertions = report => (report.testResults ?? []).flatMap(result => result.assertionResults ?? [])
const printSummary = (owner, report, infrastructure) => {
  console.log(JSON.stringify({
    owner,
    success: report.success,
    totalTests: report.numTotalTests,
    passedTests: report.numPassedTests,
    failedTests: report.numFailedTests,
    pendingTests: report.numPendingTests,
    failedSuites: report.numFailedTestSuites,
    files: (report.testResults ?? []).map(result => ({
      name: result.name,
      status: result.status,
      message: result.message,
    })),
    unhandledErrors: infrastructure?.errors?.length,
  }))
}
const rejectInfrastructureErrors = ({ report, infrastructure }, owner) => {
  if (!infrastructure || !Array.isArray(infrastructure.errors)) {
    throw new Error(`${owner}: invalid infrastructure report`)
  }
  if (infrastructure.errors.length > 0) {
    throw new Error(`${owner}: ${infrastructure.errors.length} unhandled error(s)`)
  }
  const fileErrors = (report.testResults ?? []).filter(result => result.message !== '')
  if (fileErrors.length > 0) throw new Error(`${owner}: file or collection error`)
}
const validateRed = (execution, mutant) => {
  const { report, infrastructure } = execution
  printSummary(mutant.name, report, infrastructure)
  rejectInfrastructureErrors(execution, mutant.name)
  const failed = assertions(report).filter(assertion => assertion.status === 'failed')
  const title = failed[0]?.title ?? failed[0]?.fullName ?? ''
  const failureMessages = failed[0]?.failureMessages ?? []
  const failure = failureMessages.join('\n')
  const [fileResult] = report.testResults ?? []
  if (
    report.success !== false
    || report.numPassedTests !== 0
    || report.numFailedTests !== 1
    || failed.length !== 1
    || failureMessages.length !== 1
    || report.testResults?.length !== 1
    || fileResult?.status !== 'failed'
    || !fileResult?.name?.endsWith(`${sep}${mutant.target}`)
  ) {
    throw new Error(`${mutant.name}: expected exactly one failed assertion`)
  }
  if (title !== mutant.title && !title.endsWith(mutant.title)) throw new Error(`${mutant.name}: wrong title`)
  for (const fragment of mutant.fragments) if (!failure.includes(fragment)) throw new Error(`${mutant.name}: missing ${fragment}`)
  if (!failure.includes(mutant.target)) throw new Error(`${mutant.name}: missing target stack`)
}
const validateGreen = (execution, owner) => {
  const { report, infrastructure } = execution
  printSummary(owner, report, infrastructure)
  rejectInfrastructureErrors(execution, owner)
  const passed = assertions(report).filter(assertion => assertion.status === 'passed')
  if (
    report.success !== true
    || report.numPassedTests !== 3
    || report.numFailedTests !== 0
    || passed.length !== 3
    || (report.testResults ?? []).some(result => result.status !== 'passed')
  ) {
    throw new Error(`${owner}: expected exactly 3 passed / 0 failed`)
  }
  for (const expected of mutants.map(mutant => mutant.title)) {
    const matches = passed.filter(assertion => {
      const title = assertion.title ?? assertion.fullName ?? ''
      return title === expected || title.endsWith(expected)
    })
    if (matches.length !== 1) throw new Error(`${owner}: missing or duplicate ${expected}`)
  }
}
async function cleanup(root) {
  const resolved = await realpath(root)
  if (dirname(resolved) !== temporaryParent || !basename(resolved).startsWith('landing-mutation-')) {
    throw new Error(`refusing cleanup outside owned temp: ${resolved}`)
  }
  await rm(resolved, { recursive: true })
}

try {
  const activeBefore = await hashManifest(activeRoot)
  for (const mutant of mutants) {
    const copy = await makeCopy(mutant.name, activeBefore)
    await applyMutant(copy.copyRoot, mutant.name)
    const execution = await runVitest(
      copy.copyRoot,
      [mutant.target],
      mutant.title,
      join(copy.root, 'result.json'),
      copy.reporterFile,
      1,
    )
    validateRed(execution, mutant)
    console.log(`RED confirmed: ${mutant.name}`)
  }

  const pristine = await makeCopy('pristine', activeBefore)
  const greenTargets = [...new Set(mutants.map(mutant => mutant.target))]
  const greenPattern = mutants.map(mutant => mutant.title).join('|')
  const pristineExecution = await runVitest(
    pristine.copyRoot, greenTargets, greenPattern, join(pristine.root, 'pristine.json'),
    pristine.reporterFile, 0,
  )
  validateGreen(pristineExecution, 'pristine copy')
  const activeExecution = await runVitest(
    activeRoot, greenTargets, greenPattern, join(pristine.root, 'active.json'),
    pristine.reporterFile, 0,
  )
  validateGreen(activeExecution, 'active checkout')
  requireSameManifest(activeBefore, await hashManifest(activeRoot), 'final active manifest')
  console.log('GREEN confirmed: pristine copy and active checkout; active manifest unchanged')
} finally {
  if (unconfirmedTimeoutGroups.size > 0) {
    throw new Error(`refusing temporary cleanup before confirmed process-group termination: ${[...unconfirmedTimeoutGroups].join(', ')}`)
  }
  const cleanupErrors = []
  for (const root of temporaryRoots.reverse()) {
    try { await cleanup(root) } catch (error) { cleanupErrors.push(error) }
  }
  if (cleanupErrors.length > 0) throw new AggregateError(cleanupErrors, 'temporary cleanup failed')
}
NODE
```

## Evidence report

A completed task reports:

- requirement or defect protected;
- tests added or changed;
- exact commands executed and results;
- skipped, quarantined, blocked, or unverified checks;
- browser viewport and journey when applicable;
- remaining risks or assumptions.

Never report “all tests pass” when only targeted tests were executed.

## Prohibited behavior

Agents and contributors must not:

- weaken assertions or increase tolerances merely to obtain green output;
- delete tests without a documented requirement change;
- repeatedly rerun a flaky test until it happens to pass;
- hide skipped tests or silently update snapshots;
- mock the behavior the test is intended to prove;
- change a defect and its regression test without demonstrating the original failure;
- claim release readiness while a required check is failing or unexecuted.

## Release gate

A change is release-ready only when required regressions exist, the complete verification bundle passes, critical browser journeys are verified where applicable, documentation reflects changed behavior, and remaining uncertainty is explicit.
