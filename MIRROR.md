# Mirror notice

`veilops-protocol/veilops-sdk` is a **read-only mirror**. During Phase 01 the single source of truth is [`veilops-protocol/veilops`](https://github.com/veilops-protocol/veilops), path `packages/sdk/`.

- Open issues and pull requests on `veilops-protocol/veilops`, not here. Pull requests on this repository are closed with a pointer to the monorepo.
- History here is generated with `git subtree split`, so commits touching `packages/sdk/` keep their authors and messages. A final commit overlays this repository's `README.md`, `LICENSE` and `MIRROR.md`.
- The branch `main` is **force-pushed** on every sync. Do not base work on it.

## How the mirror is published

Run from a clean checkout of the monorepo, with the satellite files available at `../veilops-github/veilops-sdk/`:

```bash
# 1. Extract the history of packages/sdk/ into a local branch (deterministic: same input, same commits)
git subtree split --prefix=packages/sdk -b mirror/veilops-sdk

# 2. Overlay the mirror's own README, LICENSE and MIRROR.md on top of the split
git worktree add ../_mirror-veilops-sdk mirror/veilops-sdk
cp ../veilops-github/veilops-sdk/README.md ../veilops-github/veilops-sdk/LICENSE ../veilops-github/veilops-sdk/MIRROR.md ../_mirror-veilops-sdk/
git -C ../_mirror-veilops-sdk add README.md LICENSE MIRROR.md
git -C ../_mirror-veilops-sdk commit -m "mirror: add veilops-sdk README, LICENSE and MIRROR notice"

# 3. Publish
git push --force git@github.com:veilops-protocol/veilops-sdk.git mirror/veilops-sdk:main

# 4. Clean up
git worktree remove ../_mirror-veilops-sdk
git branch -D mirror/veilops-sdk
```

The mirror is updated manually by a maintainer in Phase 01. Automating it (a workflow in the monorepo with a deploy key scoped to this repository) is planned.
