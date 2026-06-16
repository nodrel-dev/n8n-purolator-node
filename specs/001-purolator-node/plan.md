# Implementation Plan: Purolator Carrier Node

**Branch**: `001-purolator-node` | **Date**: 2026-06-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-purolator-node/spec.md`

## Summary

Deliver `n8n-nodes-purolator`, a verified n8n community node that exposes Purolator's
live REST carrier operations — **Estimate**, **Tracking**, **Pickup** (Schedule / Modify /
Void / Get History), and **Service Point** (Locator) — as first-class n8n actions backed by a
single managed credential. The package is a zero-runtime-dependency TypeScript node built with
the `@n8n/node-cli`, authenticating via a custom credential type whose `preAuthentication`
fetches a Bearer token (JSON body + HTTP Basic) and whose `authenticate` block injects
`Authorization: Bearer <token>` + `x-api-key` on every request (ADR-0001). The node is a
**single programmatic node** (ADR-0002) because Track's batched-array request with per-PIN
result/error isolation, FR-X-003's `Retry-After`-aware exponential backoff, and FR-X-009's
conditional Split Results toggle collectively exceed declarative routing. A shared request
helper owns retry/backoff, result splitting, status normalization (ADR-0003), carrier
fault-code surfacing (ADR-0004), and the canonical Address → per-endpoint field mapping
(ADR-0005). All non-trivial transforms are unit-tested first (Principle 10), and every
operation is exercised on both the normal and AI-Agent tool-execution paths (Principle 11).

## Technical Context

**Language/Version**: TypeScript (ES2022 target), Node.js >= 22.22 (22.16 is rejected — Inherited Guardrails / gotchas §5)

**Primary Dependencies**: **Zero runtime dependencies** (Constitution Principle 2). HTTP via n8n built-in helpers (`this.helpers.httpRequest` / `httpRequestWithAuthentication`). Dev-only: `@n8n/node-cli` (scaffold, dev, lint, release), `n8n-workflow` (peer/types), TypeScript, the test runner, ESLint via `n8n-node lint`.

**Storage**: N/A (stateless node; the only ephemeral state is the cached Bearer token held by n8n's credential layer between requests within an execution).

**Testing**: Unit tests via **vitest** for all transforms (status mapping, address mapping, option-pair assembly, package/dimension validation, account-number resolution, retry/backoff, split-results) — **test-first per Principle 10**; `pnpm test` runs in CI. Integration verification through a Docker n8n container with the package installed, run headlessly via `n8n execute --id <id>` (gotchas §9), exercising both the normal and AI-Agent tool paths (Principle 11 / SC-007).

**Target Platform**: n8n (self-hosted and cloud) as a verified community node; runs on the n8n Node.js runtime.

**Project Type**: Single-package n8n community node (`n8n-nodes-purolator`) — `nodes/` + `credentials/` layout produced by `n8n-node new`.

**Performance Goals**: No throughput SLO (carrier-bound, per-execution). Behavioural targets: bounded retry = ≤3 total attempts with ~1s-base jittered exponential backoff honoring `Retry-After` (FR-X-003); token reused within an execution and refreshed only on 401 (ADR-0001).

**Constraints**: Must pass `npx @n8n/scan-community-package n8n-nodes-purolator` with zero errors (SC-002, Principle 3). Zero runtime deps (SC-003, Principle 2). English-only UI/docs (Principle 4). No secret in any log/error/URL (FR-X-004, Principle 6). `usableAsTool: true` with identical behaviour on both execution paths (Principle 11). TypeScript `incremental` OFF (no `tsBuildInfoFile` — gotchas §7). pnpm-only toolchain. Versioning automated by **release-please** from Conventional Commits (pre-1.0: fix/feat→patch, feat!/BREAKING→minor); published via `n8n-node release` + npm OIDC Trusted Publishing with provenance from `.github/workflows/publish.yml` (Principle 9, gotchas §7). CI/CD mirrors the n8n-nodes-fedex setup.

**Scale/Scope**: v1 = 4 user-facing resources / 7 operations (Estimate; Track; Pickup ×4; Service Point) against 5 live REST APIs sharing one OAuth credential + one `X-Api-Key`. Courier `lineOfBusiness` only; Freight and the Shipping / Service-Availability APIs are deferred to v1.1.

### Outstanding live-verification items (Principle 12)

The token exchange is **CONFIRMED live** (2026-06-15): sandbox `POST /auth/v1/token` with Basic + JSON `{"grant_type":"client_credentials","scope":"portal_api"}` returns 200 with `scope: portal_api_sandbox`. The **data-plane is BLOCKED**: every authenticated Estimate/Track/Locator call returns HTTP 500 `AuthorizerConfigurationException` from API Gateway regardless of token validity — a server-side sandbox authorizer/entitlement misconfiguration (the Principle 12 trap, confirmed real), reproduced on production host too. The following carry into implementation and **MUST be closed with Purolator developer support before npm publish / verification submission** (governance compliance gate), but do **not** block writing the node against the mapped OpenAPI contracts:

- **VL-1** Estimate off-lane anchor: is `PurolatorGround` ignored or rejected on a US/INTL lane? (decides whether to force-set Primary Service for non-domestic lanes).
- **VL-2** Track enforced max PINs per request (surface as a local validation error once known; an infra ~250-entry CloudFront/WAF 403 body-size limit is *not* the documented cap).
- **VL-3** Locator `x-origin-verify` / `access-control-allow-origin` genuine enforcement + per-app-vs-constant nature; no `x-origin-verify` value is provisioned in `.env.json` yet, so the Locator success path is currently untestable.

These are tracked as `[VERIFY LIVE]` in research.md; the implementation codes the documented-default behaviour and flips on confirmation.

## Constitution Check

*GATE: evaluated against `.specify/memory/constitution.md` v1.1.0. Re-checked after Phase 1 design — still passing.*

| # | Principle | Gate | Status | Evidence |
|---|-----------|------|--------|----------|
| 1 | Single-Service Scope (NON-NEGOTIABLE) | Only Purolator bundled | ✅ PASS | One node + credential, Purolator only; no other carrier/utility. |
| 2 | Zero Runtime Dependencies (NON-NEGOTIABLE) | No `dependencies` | ✅ PASS | All HTTP via built-in helpers; REST/JSON only, no SOAP/XML lib. |
| 3 | TypeScript + n8n Guidelines + Linter Clean (NON-NEGOTIABLE) | `scan-community-package` clean | ✅ PASS (to verify in CI) | Built with `n8n-node new`; `n8n.strict: true`; scan target in SC-002. |
| 4 | English-Only | All text English | ✅ PASS | UI/docs English; `language` *param values* (en/fr) are carrier data, not UI. |
| 5 | Declarative Style Preferred | Programmatic justified | ⚠️ DEVIATION (documented) | Single programmatic node — see Complexity Tracking + ADR-0002. |
| 6 | Credentials First-Class, Never Hardcoded | Dedicated credential w/ `test` | ✅ PASS | Custom credential type + `ICredentialTestRequest` token fetch (FR-AUTH-002); secrets only in gitignored `.env.local`/`.env.json`. |
| 7 | Production-Grade Error Handling | Map errors, retry, `continueOnFail` | ✅ PASS | Shared helper: fault-code surfacing (ADR-0004), bounded backoff (FR-X-003), `continueOnFail` (FR-X-001). |
| 8 | No Competition With n8n Paid | Scope = carrier ops | ✅ PASS | Pure Purolator carrier operations. |
| 9 | Provenance Publishing | npm provenance via GH Actions | ✅ PASS (to wire in CI) | `n8n-node release` + npm OIDC Trusted Publishing (Principle 9, gotchas §7). |
| 10 | Test-First for Transformation Logic | Unit tests before impl | ✅ PASS | All transforms in §"Phase 1 transforms" tested first. |
| 11 | AI-Agent Tool Compatibility (NON-NEGOTIABLE) | `usableAsTool`, both paths tested | ✅ PASS | `usableAsTool: true`; single credential ⇒ no `authentication`-param hazard (FR-AUTH-007); both paths in SC-007. |
| 12 | Verify Against Live Behaviour (NON-NEGOTIABLE) | Live token + endpoint calls | ⚠️ PARTIAL — external blocker | Token confirmed live; data-plane blocked by carrier authorizer (VL-1..3). **Hard pre-publish gate** per governance; not a design defect. |

**Gate outcome**: PASS to proceed. The one design deviation (Principle 5) is justified below. The Principle 12 partial is an external carrier blocker, not a plan revision trigger; it is a mandatory gate before publish/verification and is tracked in research.md + the spec's Assumptions.

## Project Structure

### Documentation (this feature)

```text
specs/001-purolator-node/
├── plan.md              # This file (/speckit-plan)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (node + credential + endpoint contracts)
│   ├── credential.md
│   ├── node-operations.md
│   └── endpoint-map.md
├── checklists/
│   └── requirements.md  # (pre-existing) spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

Layout produced by `n8n-node new` (verified-node convention — single package, `nodes/` + `credentials/`):

```text
n8n-nodes-purolator/
├── credentials/
│   └── PurolatorApi.credentials.ts        # custom type: preAuthentication token fetch + authenticate (Bearer + x-api-key), env selector, optional x-origin-verify + default account; ICredentialTestRequest
├── nodes/
│   └── Purolator/
│       ├── Purolator.node.ts              # single programmatic node; usableAsTool: true; routes operation → handler
│       ├── purolator.svg                  # node icon
│       ├── descriptions/                  # n8n INodeProperties per resource (UI params)
│       │   ├── estimate.ts
│       │   ├── tracking.ts
│       │   ├── pickup.ts
│       │   └── servicePoint.ts
│       ├── operations/                    # per-operation request assembly + response shaping
│       │   ├── estimate.ts
│       │   ├── tracking.ts
│       │   ├── pickup.ts                  # schedule / modify / void / getHistory
│       │   └── servicePoint.ts
│       └── transforms/                    # PURE, unit-tested-first (Principle 10)
│           ├── address.ts                 # canonical Address → per-endpoint field names (ADR-0005)
│           ├── statusMap.ts               # carrier statusCode/subCode → normalizedStatus (ADR-0003)
│           ├── options.ts                 # curated + generic options → carrier option-pair list
│           ├── packageValidation.ts       # all-three-or-none dims, country=CA, required presence (FR-X-011)
│           ├── pickupValidation.ts        # shipmentSummary (≥1, unique destinationCode, consistent unit) + Contact presence (FR-007 / FR-X-011)
│           ├── accountNumber.ts           # override → credential default → fail (FR-X-012)
│           ├── splitResults.ts            # Split Results toggle shaping (FR-X-009)
│           └── classifyError.ts           # mirror-the-carrier error vs result (ADR-0004 / FR-X-010)
│       └── transport/
│           ├── request.ts                 # httpRequestWithAuthentication wrapper
│           └── retry.ts                   # bounded jittered backoff + Retry-After (FR-X-003)
├── test/                                  # unit tests mirroring transforms/ (test-first)
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                         # pnpm install + lint + test + build on PR/push (parity w/ FedEx)
│   │   └── publish.yml                    # release-please (semver from Conventional Commits) → npm OIDC Trusted Publishing + provenance (Principle 9). Filename pinned by npm Trusted Publisher config.
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── ISSUE_TEMPLATE/{config,bug_report,feature_request}.yml
├── release-please-config.json             # pre-1.0 semver: fix/feat→patch, feat!/BREAKING→minor
├── .release-please-manifest.json          # version source of truth (seeded 0.1.0)
├── CHANGELOG.md                           # maintained by release-please (do not hand-edit)
├── CONTRIBUTING.md  SECURITY.md  CODE_OF_CONDUCT.md   # community-health docs
├── pnpm-workspace.yaml                    # pnpm allowBuilds (eslint-plugin-n8n-nodes-base, isolated-vm, unrs-resolver)
├── package.json                           # pnpm-only; n8n.strict: true; incremental OFF; zero runtime deps; scripts build/lint/test/release/prepublishOnly; version 0.1.0
├── tsconfig.json                          # incremental: false (no tsBuildInfoFile — gotchas §7)
├── vitest.config.mts                      # unit test runner config
├── README.md                              # ≥1 example per operation (SC-004), field-name mapping note
└── LICENSE
```

**Structure Decision**: Single-package n8n community node using the standard `nodes/` + `credentials/` layout from `n8n-node new` (required so structure/metadata match verification, Principle 3 / gotchas). Within `nodes/Purolator/`, UI param definitions (`descriptions/`), per-operation request/response logic (`operations/`), pure transforms (`transforms/`), and the auth-aware transport (`transport/`) are separated so the Principle-10 transforms stay pure and independently testable, and the single programmatic node (`Purolator.node.ts`, ADR-0002) stays a thin dispatcher. Files target 200–400 lines, 800 max.

## Complexity Tracking

> Documents the single deviation from a non-NON-NEGOTIABLE principle (Principle 5).

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| **Programmatic node style** instead of the preferred declarative routing (Principle 5) | Three cross-cutting requirements collectively exceed declarative routing: FR-X-003 retry (exponential backoff honoring `Retry-After`, vs n8n's fixed-interval `retryOnFail`); FR-X-009 conditional Split Results toggle; Track's batched-array request needing per-PIN result/error isolation under `continueOnFail`. See ADR-0002. | **Declarative routing**: cannot express custom backoff, conditional output shaping, or per-element batch error isolation. **Mixed style** (declarative for Estimate/Pickup/Locator, programmatic for Track): a single consistent programmatic node is more maintainable than a split-style node and avoids two error-handling code paths; ADR-0002. Auth stays at credential level, single-credential ⇒ no Principle 11 `authentication`-param hazard. |
</invoke>
