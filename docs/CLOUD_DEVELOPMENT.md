# Cloud Development

This repository uses GitHub Codespaces as an optional isolated development workspace and GitHub-hosted pull-request Actions as the authoritative verification lane.

## Safety rules

- Start every change from a fresh feature branch; do not work directly on `main`.
- A Git worktree or branch prevents source collisions, not supply-chain execution on the host.
- Do not attach unrelated personal secrets or dotfiles to the Codespace.
- Dependency installation is deliberately **not** a devcontainer post-create command. Run it explicitly when the task requires execution.
- Treat pull-request Actions as authoritative; local/Codespace success is feedback, not release evidence.
- Stop the Codespace when work ends.

## Standard verification

```bash
npm ci --no-audit --no-fund
npm run verify
npm run test:e2e
```

`verify` runs the complete unit/process/lint/build bundle and the blocking
runtime dependency audit. Development-tool advisories are reviewed separately;
they are not silently treated as browser-runtime vulnerabilities. The pull
request must also pass the `verify`, browser, and `dependency-review` checks
before merge.

## Agent evidence

An agent-run task records:

- base/head commit SHA and branch;
- execution environment;
- exact checks run or not run;
- spawned worker reason, model route, expected artifact, and result disposition;
- immutable pull-request SHA used for independent review;
- Codespace stop result.
