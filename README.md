# BerryEditor

BerryEditor is a React-first rich text editor built with a TypeScript editor engine and HTML as the canonical content format, designed for apps that need customizable authoring controls and predictable HTML persistence.

## What This Repo Contains

```text
BerryEditor/
  packages/berryeditor   Publishable package (`@appberry/berryeditor`) with React components, editor engine, styles, and tests.
  apps/docs              Next.js docs/playground app with App Router and Pages Router integration examples.
```

## Prerequisites

- Node.js `>=20`
- Corepack (recommended by pnpm for project-pinned package manager versions)
- `pnpm`

`engines.node` in `package.json` is advisory by default in npm unless users enable `engine-strict`, so verify local Node before running workspace scripts.

## Environment Setup (Corepack + pnpm)

This workspace pins `pnpm@10.6.4` via the root `packageManager` field. The pnpm installation docs recommend using Corepack so contributors use the expected pnpm version.

```bash
npm install --global corepack@latest
corepack enable pnpm
pnpm --version
```

If Corepack reports outdated signatures, update Corepack and run `corepack enable pnpm` again.

## Quick Start (Contributors)

```bash
pnpm install
pnpm dev
```

`pnpm dev` starts the docs app used for local development and manual testing.

## Development Commands

- `pnpm build` builds all workspace packages and apps.
- `pnpm lint` runs ESLint across the workspace.
- `pnpm typecheck` runs TypeScript checks with `--noEmit`.
- `pnpm test` runs workspace test suites (Vitest-based package tests plus app placeholders).
- `pnpm test:e2e` runs Playwright editor E2E tests via the docs app.

## Testing Strategy

- Unit and integration tests are implemented with Vitest in `packages/berryeditor/tests`.
- End-to-end coverage is implemented with Playwright in `packages/berryeditor/tests/e2e` against the docs app runtime.

## Documentation and Examples

- Package usage and API docs: `packages/berryeditor/README.md`
- Local integration references in the docs app:
  - App Router example: `/app-router`
  - Pages Router example: `/pages-router`
- Official docs used by this repo:
  - pnpm installation and Corepack usage: https://pnpm.io/installation
  - npm `package.json` fields (`engines`, `packageManager`): https://docs.npmjs.com/cli/v11/configuring-npm/package-json
  - Next.js client component boundary (`'use client'`): https://nextjs.org/docs/app/api-reference/directives/use-client
  - Next.js transpiling external/workspace packages: https://nextjs.org/docs/pages/api-reference/config/next-config-js/transpilePackages

## License

Apache-2.0
