# Supply-Chain Security Notes

Last reviewed: 2026-07-13

## Controls

- GitHub Actions use GitHub-hosted runners only.
- Third-party actions are pinned to full commit SHAs; version comments remain for Dependabot maintenance.
- Workflow permissions are least-privilege. Dependency installation and build jobs receive read-only repository access.
- GitHub Pages write and OIDC permissions exist only on the deployment job, after the build job succeeds.
- Pull requests run tests, lint, production build, a high-severity npm audit, and dependency review.
- Dependabot monitors npm and GitHub Actions dependencies weekly.
- `npm ci` restores the committed lockfile and verifies package integrity metadata.
- Workflows do not consume repository secrets and do not use self-hosted runners.

## Pinned actions

The following refs were resolved through the public GitHub API on 2026-07-13:

| Action | Version line | Commit |
|---|---|---|
| `actions/checkout` | v4 | `34e114876b0b11c390a56381ad16ebd13914f8d5` |
| `actions/setup-node` | v4 | `49933ea5288caeca8642d1e84afbd3f7d6820020` |
| `actions/configure-pages` | v5 | `983d7736d9b0ae728b81ab479565c72886d7745b` |
| `actions/upload-pages-artifact` | v3 | `56afc609e74202658d3ffba0e8f6dda462b719fa` |
| `actions/deploy-pages` | v4 | `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e` |
| `actions/dependency-review-action` | v4 | `2031cfc080254a8a887f58cffee85186f0e49e48` |

## Limits

These controls reduce known workflow and dependency risks; they do not prove that dependencies or generated artifacts are safe. Dependency updates still require review of lockfile changes, release notes, CI evidence, and relevant runtime behavior before merge.
