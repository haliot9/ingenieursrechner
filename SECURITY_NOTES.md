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
| `actions/checkout` | v7 | `9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0` |
| `actions/setup-node` | v6 | `48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e` |
| `actions/configure-pages` | v6 | `45bfe0192ca1faeb007ade9deae92b16b8254a0d` |
| `actions/upload-pages-artifact` | v5 | `fc324d3547104276b827a68afc52ff2a11cc49c9` |
| `actions/deploy-pages` | v5 | `cd2ce8fcbc39b97be8ca5fce6e763baed58fa128` |
| `actions/dependency-review-action` | v5 | `a1d282b36b6f3519aa1f3fc636f609c47dddb294` |

## Limits

These controls reduce known workflow and dependency risks; they do not prove that dependencies or generated artifacts are safe. Dependency updates still require review of lockfile changes, release notes, CI evidence, and relevant runtime behavior before merge.
