# Contributing to n8n-nodes-purolator

Thanks for your interest! This is an [n8n community node](https://docs.n8n.io/integrations/community-nodes/)
that talks directly to the Purolator REST API. Contributions — bug reports, fixes, new operations —
are welcome.

By participating you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Getting set up

**Use [pnpm](https://pnpm.io/).** npm installs are blocked (the toolchain enforces it with an
`only-allow` postinstall). Node.js **22.22+** is required (22.16 is rejected).

```bash
pnpm install
pnpm build      # n8n-node build — compile + copy assets
pnpm lint       # n8n-node lint (strictness from n8n.strict: true)
pnpm test       # vitest (unit tests for the pure transforms)
pnpm dev        # n8n-node dev — runs n8n locally with the node loaded + live rebuild
```

> Under `pnpm dev` the live node type is `CUSTOM.purolator`, not
> `n8n-nodes-purolator.purolator` — the published type only applies after an npm install. Make
> sure your test workflows reference the right one.

## Testing your change

Per the project constitution, **every non-trivial transform ships with unit tests written first**
(status-code mapping, address normalization, option-pair assembly, package/dimension validation,
account-number resolution, retry/backoff, split-results). These pure transforms live in
`nodes/Purolator/transforms/` and are what `pnpm test` covers.

Beyond unit tests, behavior is verified **end to end against the Purolator sandbox** through a
Docker n8n container running headlessly via `n8n execute --id <id>`, exercising **both** the normal
node path and the AI-Agent tool-execution path (they run different credential-resolution code).

> ⚠️ The Purolator **sandbox data-plane** is currently returning
> `AuthorizerConfigurationException` for authenticated Estimate/Track/Locator calls (a server-side
> carrier authorizer issue). The token exchange is confirmed working. Until Purolator support
> resolves it, exercise data-plane changes against captured contract fixtures and note this in
> your PR.

Please confirm `pnpm build`, `pnpm lint`, and `pnpm test` all pass before opening a PR.

## How the node is organized

- One programmatic node, `nodes/Purolator/Purolator.node.ts` (`usableAsTool: true`), with four
  user-facing resources:
  - **Estimate** → Estimate (`/rate/v1/shipment`)
  - **Tracking** → Track (`/track/v1/shipment`)
  - **Pickup** → Schedule, Modify, Void, Get History (`/pickup/v1/*`)
  - **Service Point** → Find (`/locator/v1/address`)
- A **single** credential type, `credentials/PurolatorApi.credentials.ts`, covers all operations
  (one OAuth token + one `X-Api-Key`).
- Per-resource UI definitions live in `nodes/Purolator/descriptions/`; request/response logic in
  `nodes/Purolator/operations/`; reusable, context-free logic in `nodes/Purolator/transforms/`
  (these are what the unit tests cover); the auth-aware transport in `nodes/Purolator/transport/`.
- Architecture decisions are documented in [`docs/adr/`](./docs/adr/) and the ubiquitous language
  in [`CONTEXT.md`](./CONTEXT.md). Skim them before larger changes.

> User-facing naming matters: it's **Estimate** (not Rate/Quote), **Tracking** (not Trace),
> **Service Point** (not Locator). Raw Purolator field names (`provinceStateCode`, etc.) are an
> internal mapping detail, never user-facing — see [ADR-0005](./docs/adr/0005-unified-address-model.md).

## Commits & releases

- Follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`,
  `chore:`, `refactor:`, `test:`, `ci:`, and `feat!:` / `BREAKING CHANGE:` for breaking changes.
- Releases are automated by **release-please** from those commit messages, then published to npm
  with provenance — no manual version bumps. Don't edit `package.json` `version` or `CHANGELOG.md`.
- Pre-1.0 versioning: `fix:` and `feat:` → **patch**; `feat!:` / `BREAKING CHANGE:` → **minor**.
- **Don't modify the ESLint config** — CI verifies it is unchanged from the n8n default.

## Pull requests

1. Branch from `main`, make focused commits.
2. Ensure build, lint, and tests pass and you've sandbox-tested the change (see the caveat above).
3. Fill out the PR template, including confirming **no credentials/secrets** are included.
4. Link any related issue.

## Security & credentials

Never commit or paste Purolator `client_id`, `client_secret`, `X-Api-Key`, OAuth tokens, or
account numbers anywhere in the repo, issues, or PRs. See [SECURITY.md](./SECURITY.md). Keep
secrets in n8n's credential store or a local `.env.local` (gitignored). If a secret is ever
committed, **rotate it in the Purolator portal** — redacting is not enough (git retains orphaned
commits).
