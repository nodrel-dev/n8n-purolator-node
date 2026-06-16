# Quickstart & Validation Guide: Purolator Carrier Node

**Feature**: 001-purolator-node | **Date**: 2026-06-15

How to build, run, and validate `n8n-nodes-purolator`. Runnable validation scenarios that prove
the feature works end to end. Implementation detail lives in `tasks.md` and the code; design
detail in [plan.md](./plan.md), [data-model.md](./data-model.md), and [contracts/](./contracts/).

## Prerequisites

- Node.js **>= 22.22** (22.16 is rejected — gotchas §5).
- **pnpm** (npm installs are blocked via `only-allow`); npm **>= 11.5.1** is used in CI for OIDC Trusted Publishing.
- Docker (for the verification harness).
- A Purolator API app: `client_id`, `client_secret`, `X-Api-Key`. Secrets in a gitignored `.env.local` / `.env.json` only (Principle 6). Default environment = **sandbox**.

## Build & dev

```bash
pnpm install
pnpm dev                # n8n-node dev — live-reload; node appears as CUSTOM.purolator (gotchas §4)
pnpm lint               # n8n-node lint — strictness from n8n.strict:true (gotchas §5)
pnpm test               # vitest unit tests for all transforms (written first — Principle 10)
pnpm build              # n8n-node build
npm pack --dry-run      # confirm tarball = LICENSE + README + dist only (gotchas §7)
npx @n8n/scan-community-package @nodrel-dev/n8n-nodes-purolator   # MUST be zero errors (SC-002)
```

CI (`.github/workflows/ci.yml`) runs `pnpm lint`, `pnpm test`, and `pnpm build` on every PR and
push to `main`.

> Keep TypeScript `incremental` OFF — a stale `tsBuildInfoFile` survives `rimraf dist` and produces an incomplete `dist` that fails at load (gotchas §7).

## Credential setup

Create a **Purolator API** credential: `clientId`, `clientSecret`, `apiKey`, `environment`
(sandbox), optional `xOriginVerify` (Locator), optional `defaultAccountNumber`. Click **Test** —
it performs a token fetch (no billable call) and must succeed (FR-AUTH-002). See
[contracts/credential.md](./contracts/credential.md).

## Validation scenarios (map to spec acceptance criteria)

Each scenario is run **twice** — once as a normal node, once on the AI-Agent tool path — and
must behave identically (SC-007, Principle 11).

1. **Estimate (US1)**: CA origin → CA/US/INTL receiver, ≥1 package. Expect eligible services with base price, surcharges, taxes, total, transit days. Multi-piece rates at shipment level in one call. Unserviceable lane → clear carrier **error** (not empty result). Invalid credentials → clear auth error, no secret leak.
2. **Tracking (US2)**: known PIN → current status + `normalizedStatus` + raw code, event history, POD image when `pod=true`. Batch of PINs → independent per-entry results; a not-found PIN → `found:false` **success** item (batch not failed). Reference matching multiple shipments with no date range/account → carrier disambiguation error.
3. **Pickup (US3)**: Schedule from a valid CA street address + date/window/location + ≥1 shipment summary → `pickupConfirmationNumber`. Modify a Scheduled/Dispatched pickup → accepted (else status constraint). Void → `pickupVoided:true`. Get History (≤50 confirmations) → records or empty success. P.O. Box/Rural Route/General Delivery origin → carrier address constraint error.
4. **Service Point (US4)**: postal code → nearby locations ordered ascending by distance. Capability filters (holdForPickup/dangerousGoods/kiosk) → only matching locations.
5. **Cross-cutting**: `continueOnFail` with one bad item → valid items still process, bad item returns structured error. Transient 5xx/429 → bounded retry then clear error. `Split Results` toggle ON vs OFF → one-item-per-result vs nested-array, identical on both paths.

## Verification harness (gotchas §9)

Run a Docker n8n container with the package installed; execute workflows **headlessly** via
`n8n execute --id <id>` on a separate broker port (not the unreliable chat webhook). The public
REST API has no execute/node-types endpoint and `PUT /workflows/{id}` needs the full body with
`settings:{"executionOrder":"v1"}` (gotchas §6).

## Known blocker (Principle 12)

Sandbox/production **data-plane** calls currently return HTTP 500
`AuthorizerConfigurationException` (carrier authorizer/entitlement bug — not a request defect).
The token exchange is confirmed live. Scenarios 1–5 can be authored and unit-validated now;
live data-plane confirmation and the open items **VL-1** (Estimate off-lane anchor), **VL-2**
(Track max PINs), **VL-3** (Locator `x-origin-verify` enforcement) require Purolator developer
support and **must be closed before npm publish / verification submission**. See
[research.md](./research.md).

## Release (Principle 9, gotchas §7)

Versioning is automated by **release-please** from Conventional Commits — do not hand-edit
`package.json` `version` or `CHANGELOG.md`. Pre-1.0: `fix:`/`feat:` → patch, `feat!:`/`BREAKING
CHANGE:` → minor (configured in `release-please-config.json`).

1. Merge `feat:`/`fix:` commits to `main`.
2. release-please opens/updates a **release PR** bumping the version + CHANGELOG.
3. Merging that PR creates the git tag + GitHub Release, and `.github/workflows/publish.yml`
   runs `pnpm run release` (`n8n-node release`) to publish to npm with provenance via OIDC
   Trusted Publishing — no `NPM_TOKEN`. The npm Trusted Publisher must be registered against the
   `publish.yml` filename.

`n8n-node release` is the only supported publish path (the `prepublishOnly` guard exits 1
otherwise). A `404 PUT` on the scoped package = the publish ran unauthenticated; first-publish CDN
propagation can lag ~5 min. For the initial `0.1.0` (which release-please treats as already
released at the seeded manifest), use the `workflow_dispatch` escape hatch on the Release workflow.

## Success criteria checklist

- [ ] SC-001 rate/track/pickup/locate end to end with one credential
- [ ] SC-002 `scan-community-package` zero errors
- [ ] SC-003 zero runtime dependencies
- [ ] SC-004 ≥1 README example per operation
- [ ] SC-005 invalid creds + unserviceable lane → clear errors, no secret leak
- [ ] SC-006 builds, publishes via GH Actions with provenance, accepted for verification
- [ ] SC-007 every operation verified on normal **and** AI-Agent tool paths in Docker harness
