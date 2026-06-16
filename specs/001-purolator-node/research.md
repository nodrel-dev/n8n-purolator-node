# Phase 0 Research: Purolator Carrier Node

**Feature**: 001-purolator-node | **Date**: 2026-06-15

This consolidates the technical unknowns from the Technical Context. Most were resolved
during `/speckit-specify` and `/speckit-clarify` (see spec Clarifications + Assumptions) and
captured as ADRs; this file records the decisions in one place and tracks the open
live-verification items. Format per decision: **Decision / Rationale / Alternatives considered**.

## R1 — Node style: programmatic vs declarative

- **Decision**: Single **programmatic** node for all v1 operations. (ADR-0002)
- **Rationale**: Track's batched array with per-PIN result/error isolation under `continueOnFail`, FR-X-003's `Retry-After`-aware exponential backoff, and FR-X-009's conditional Split Results toggle cannot be expressed by declarative routing. A consistent programmatic node beats a mixed-style node.
- **Alternatives considered**: Declarative routing (rejected — can't do custom backoff, conditional output shaping, or batch error isolation); mixed style (rejected — two error paths, harder to maintain).

## R2 — Authentication model

- **Decision**: Custom credential type with `preAuthentication` (JSON body + HTTP Basic) caching the Bearer token, and an `authenticate` block injecting `Authorization: Bearer <token>` + `x-api-key` on every request. Rely on n8n's refresh-on-401, not proactive pre-expiry refresh. (ADR-0001, FR-AUTH-003/004)
- **Rationale**: `POST /auth/v1/token` takes an `application/json` body (`grant_type`+`scope`) with Basic creds, so n8n's built-in form-encoded OAuth2 client-credentials grant cannot be used. **CONFIRMED LIVE (2026-06-15)**: sandbox token call returns 200, `token_type: Bearer`, `expires_in: 3600`, `scope: portal_api_sandbox`. Proactive refresh would duplicate auth logic on the AI-Agent tool path (where credential resolution differs — Principle 11) for little gain inside one short execution.
- **Alternatives considered**: Built-in OAuth2 credential (rejected — wrong body encoding); proactive token refresh in node code (rejected — Principle 11 divergence risk; ADR-0001 relaxes FR-AUTH-004's literal "proactive" to 401-refresh).

## R3 — Credential cardinality

- **Decision**: **One** credential type for all v1 APIs; single `bearerAuth` scheme + one shared `X-Api-Key`. No `authentication` node parameter. (FR-AUTH-007, Principle 11)
- **Rationale**: All five live APIs share one OAuth scope (`portal_api`) and one API key with no per-API entitlement split. Single-credential nodes don't hit the Principle 11 `authentication`-param tool-path hazard.
- **Alternatives considered**: Multi-credential with an `authentication` param (rejected — not needed for v1; re-evaluate if v1.1 introduces a separately-entitled API, e.g. Shipping).

## R4 — Tracking status normalization

- **Decision**: Emit **both** raw carrier `statusCode`/`subCode`/description **and** a `normalizedStatus` from an additive-only set: `Created, InTransit, OutForDelivery, AttemptedDelivery, Delivered, HeldForPickup, Exception, ReturnToSender, Cancelled, Unknown`. Unmapped → `Unknown` (never an error). (ADR-0003, FR-X-005)
- **Rationale**: Purolator's OAS defines the status fields but publishes no enum; live responses contain unseen codes. Dual emission satisfies FR-X-005 without data loss; additive-only keeps downstream branches stable; `Unknown` fallback prevents failures on new codes. Mapping is a pure function, unit-tested first (Principle 10).
- **Alternatives considered**: Raw passthrough only (fails FR-X-005); strict normalization dropping raw (brittle, undebuggable). Pickup keeps its separate fixed set: `Scheduled, Dispatched, Cancelled, NoPickup, PickedUp, Pending`.

## R5 — Error vs result classification

- **Decision**: **Mirror the carrier.** A carrier error *response* (4xx/5xx, auth, validation, malformed) → n8n error (thrown or structured error item under `continueOnFail`), carrying fault code + message, secrets stripped. A carrier **200 with a negative payload** (not-found PIN → `found:false`; empty services/locations/history → empty arrays) → normal success item. (ADR-0004, FR-X-010)
- **Rationale**: Resolves the FR-X-009 ⇄ US2.3 contradiction. Unserviceable lane (US1.3) is a carrier error response, hence an n8n error; not-found PIN is a 200, hence a result — preserving Track's per-PIN batch isolation.
- **Alternatives considered**: Treat any "negative" outcome as error (rejected — breaks batch isolation and would error on empty result sets).

## R6 — Canonical Address model

- **Decision**: One node-facing `Address` (`street, city, province, country, postalCode`, optional `companyName`) + a thin per-endpoint transform to each API's native names. Pickup `Contact` (`name`, `phoneNumber`, optional company/extension) stays separate. (ADR-0005)
- **Rationale**: Estimate (`provinceStateCode`/`postalZipCode`), Pickup (`province`/`postalCode`), Locator (`provinceCode`/`postalCode`) use three conventions. One shape = cross-operation consistency (reviewer quality signal), one AI-tool schema (Principle 11), and the mapping is exactly the payload-assembly transform Principle 10 already requires tests for.
- **Alternatives considered**: Mirror each API's raw field names (rejected — three mental models, worse AI schema). Trade-off recorded: renaming these user-facing fields later breaks saved workflows.

## R7 — Shipment options: hybrid exposure

- **Decision**: High-frequency shipment options (signature/AdultSignatureRequired, DeclaredValue, HoldForPickup, residential signature, DangerousGoods class/mode) as first-class typed params; long-tail + future option IDs via a generic "Additional Options" `{optionId, optionIdValue}` collection. Piece-level SpecialHandling similarly. The node assembles the carrier's option-pair list from both. (FR-001)
- **Rationale**: Closed enums (14 shipment-level IDs) — surfacing all as typed params bloats the UI; the hybrid keeps common cases ergonomic and the tail/future-proofed. The curated→pairs mapping is a unit-tested transform (Principle 10).
- **Alternatives considered**: All-typed (rejected — UI bloat, brittle to new option IDs); all-generic (rejected — poor UX/AI schema for common cases).

## R8 — Split Results output shaping

- **Decision**: Per-operation `Split Results` toggle on multi-result ops (Estimate services, Track entries, Service Point locations). Default ON = one n8n item per result element; OFF = one item per input with results as a nested array. Identical on normal + tool paths. (FR-X-009)
- **Rationale**: Matches the clarified output-shape decision; downstream workflows often want one-item-per-result, but some want the nested form. Pure shaping transform, tested.
- **Alternatives considered**: Fixed single-item or fixed split (rejected — neither fits all workflows).

## R9 — Retry / backoff policy

- **Decision**: ≤3 total attempts on 5xx/429 with jittered exponential backoff (~1s base), honoring `Retry-After` when present; no retries on 4xx. (FR-X-003)
- **Rationale**: Clarified policy. n8n's fixed-interval `retryOnFail` can't honor `Retry-After` or do exponential jitter, so the shared transport helper owns it (reinforces the programmatic-style decision R1).
- **Alternatives considered**: n8n built-in `retryOnFail` (rejected — fixed interval, ignores `Retry-After`).

## R10 — Validation posture

- **Decision**: Local validation is **minimal and structural** only: required-field presence to assemble a well-formed request, dimensions all-three-or-none, sender `country=CA`, and account-number resolution (FR-X-012) — each with a clear message. All other business rules (serviceability, 150 lb/68 kg cap, P.O. Box/Rural Route/General Delivery pickup constraints, batch caps) pass through to Purolator and surface via mirror-the-carrier. (FR-X-011)
- **Rationale**: Re-implementing the carrier rulebook causes drift. The few local checks exist only where the carrier's own error would be confusing. Local helpers are unit-tested; carrier rules are not (Principle 10).
- **Alternatives considered**: Full client-side validation (rejected — drift, maintenance burden).

## R11 — Build / release toolchain

- **Decision**: Scaffold + build with `@n8n/node-cli` (`n8n-node new/dev/lint/release`). Node >= 22.22. `n8n.strict: true` in `package.json`. TypeScript `incremental` OFF (no `tsBuildInfoFile`). Publish via `n8n-node release` (never raw `npm publish`) using npm OIDC Trusted Publishing (GitHub Actions, `id-token: write`, npm >= 11.5.1) with provenance. (Inherited Guardrails / gotchas §5,§7; Principle 3, 9)
- **Rationale**: Matches verified-node structure/metadata from the start; avoids the stale-`tsBuildInfoFile` incomplete-`dist` load failure; provenance is required for verification submissions from May 1 2026.
- **Alternatives considered**: Manual TS build + raw `npm publish` (rejected — `prepublishOnly` guard exits 1; misses provenance; structure drift).

## R12 — Test harness

- **Decision**: Unit tests (test-first, Principle 10) for every transform; integration verification via a Docker n8n container with the package installed, run headlessly with `n8n execute --id <id>` on a separate broker port, exercising **both** normal and AI-Agent tool paths. Remember dev-mode node type is `CUSTOM.<nodeName>`, published type only after npm install. (gotchas §4,§9; SC-007, Principle 11)
- **Rationale**: The headless chat webhook is unreliable; `n8n execute --id` is the proven harness. Tool-path resolution runs different credential code, so both paths must be tested.
- **Alternatives considered**: Headless chat webhook (rejected — unreliable, gotchas §9); public REST API execute endpoint (rejected — doesn't exist, gotchas §6).

## Open live-verification items (Principle 12) — BLOCKED

Sandbox data-plane returns HTTP 500 `AuthorizerConfigurationException` for all authenticated
Estimate/Track/Locator calls regardless of token validity (server-side authorizer/entitlement
bug, reproduced on production host; `.env.json` creds are sandbox-scoped). These require
Purolator developer support and **must be closed before npm publish / verification submission**.
The implementation codes documented-default behaviour and flips on confirmation.

- **VL-1** Estimate off-lane anchor service: is `PurolatorGround` ignored or rejected on a US/INTL lane? → Default: keep `PurolatorGround` anchor with `showAlternativeServicesIndicator=true`; if rejected live, document "set Primary Service for non-domestic lanes." (FR-001)
- **VL-2** Track enforced max PINs per request → Default: no hard local cap beyond char-length; surface the carrier's limit as a local validation error once known. (The ~250-entry CloudFront/WAF 403 is an infra body-size limit, not the documented cap.) (FR-004)
- **VL-3** Locator `x-origin-verify` / `access-control-allow-origin` enforcement + per-app-vs-constant nature; `x-origin-verify` not yet provisioned in `.env.json` → Default: `x-origin-verify` is an optional credential field injected only on Locator; `access-control-allow-origin` omitted unless live-verify proves enforcement, then injected as a constant. (FR-AUTH-006)
