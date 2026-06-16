# Feature Specification: Purolator Carrier Node

**Feature Branch**: `001-purolator-node`

**Created**: 2026-06-15

**Status**: Draft — REST-only v1 scope locked; all v1 OpenAPI specs + business rules gathered and mapped; ready for `/speckit-plan`

**Input**: User description: "Automate Purolator shipping operations from within n8n workflows — a verified community node exposing Purolator's core carrier operations (estimate, track, pickup, locator) as first-class n8n actions with managed credentials."

## Overview

n8n users who ship with Purolator currently have no native or community node. They hand-build raw HTTP requests, manage authentication manually, and re-implement carrier error handling in every workflow. This feature delivers a verified community node that exposes Purolator's core carrier operations as first-class n8n actions with managed credentials, scoped to what Purolator's REST API exposes today.

## Clarifications

### Session 2026-06-15

- Q: For batch / multi-result operations, how should the node shape its n8n output items? → A: Configurable "Split Results" toggle per operation — default one n8n item per result element, with an option to return results as a nested array on a single per-input item.
- Q: What concrete retry policy should v1 implement for transient 5xx/throttle responses? → A: Up to 3 total attempts on 5xx/429 with jittered exponential backoff (~1s base), honoring a `Retry-After` header when present; no retries on 4xx.
- Q: Which environment should the credential default to? → A: Sandbox (`https://shipapi-sandbox.purolator.com`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rate / Estimate a Shipment (Priority: P1)

As an operations person automating order fulfillment in n8n, I configure a Purolator credential once and run an Estimate action with origin, destination, and package details so I can compare available services, prices, and transit times inside a workflow without writing custom HTTP requests.

**Why this priority**: Rating is the most frequently used carrier operation and the foundation of any fulfillment workflow (choosing a service before shipping). It also exercises the full credential + auth path, so it is the minimum viable slice that proves the node works end to end.

**Independent Test**: With a valid sandbox credential, run Estimate for a Canadian origin and a CA/US/INTL destination with one or more packages; verify the node returns eligible services with base price, surcharges, taxes, total, and transit days.

**Acceptance Scenarios**:

1. **Given** valid Purolator credentials, **When** the user runs an Estimate operation with origin, destination, and package details, **Then** the node returns available services with prices and transit times.
2. **Given** a multi-piece shipment, **When** the user runs Estimate, **Then** the node rates at the shipment level and returns all eligible services in a single call.
3. **Given** an unserviceable origin/destination pair, **When** the user runs Estimate, **Then** the node surfaces a clear, actionable carrier error without leaking secrets.
4. **Given** invalid credentials, **When** Estimate runs, **Then** the node fails with a clear authentication error and does not expose secret values.

---

### User Story 2 - Track a Package (Priority: P2)

As an operations person, I run a Track action with one or more PINs or shipment references so I can surface current status, full event history, and (where available) proof-of-delivery imagery into a workflow.

**Why this priority**: Tracking is the second most common carrier operation and provides post-ship visibility. It is independently valuable even without rating.

**Independent Test**: With a valid credential, run Track on a known PIN; verify the node returns current status, event history, and a POD image when `pod=true`.

**Acceptance Scenarios**:

1. **Given** a known PIN, **When** the user runs Track, **Then** the node returns the current status, event history, and (where available) photo POD for that shipment.
2. **Given** a batch of tracking IDs, **When** the user runs Track, **Then** each entry is resolved and per-package detail is returned for multi-piece shipments.
3. **Given** a PIN that does not exist or has aged out, **When** the user runs Track, **Then** the node returns a clear "not found" result without failing the whole batch.
4. **Given** a reference search that matches multiple shipments, **When** no date range or account number is supplied, **Then** the node surfaces the carrier's disambiguation requirement.

---

### User Story 3 - Schedule and Manage Pickups (Priority: P3)

As an operations person, I run Pickup actions (schedule, modify, void, get history) so I can arrange and manage carrier collection without leaving n8n.

**Why this priority**: Pickup management is valuable but less frequent than rating and tracking, and depends on an established shipping cadence.

**Independent Test**: With a valid credential, schedule a pickup from a valid Canadian street address and date; verify a confirmation identifier is returned, then modify, void, and retrieve history for it.

**Acceptance Scenarios**:

1. **Given** an origin address, contact (name + phone), a date and time window, a pickup location, and at least one shipment summary (destination region, pieces, weight, mode), **When** the user runs Schedule Pickup, **Then** the node confirms the pickup and returns its confirmation number.
2. **Given** a scheduled or dispatched pickup, **When** the user runs Modify, **Then** the change is accepted; otherwise the node surfaces the status constraint.
3. **Given** a scheduled pickup, **When** the user runs Void, **Then** the node confirms cancellation (`pickupVoided` true).
4. **Given** up to 50 confirmation numbers, **When** the user runs Get History, **Then** matching records are returned, or a clear empty result when none match.
5. **Given** a P.O. Box / Rural Route / General Delivery origin, **When** the user runs Schedule Pickup, **Then** the node surfaces the carrier's address constraint.

---

### User Story 4 - Locate Service Points (Priority: P4)

As an operations person, I run a Locator action with an address or postal code so I can present nearby Purolator service points / drop-off locations in a workflow.

**Why this priority**: Locator is a supporting convenience operation, independently useful but the least central to fulfillment automation.

**Independent Test**: With a valid credential, run Locator for a postal code; verify nearby locations are returned ordered by ascending distance, with capability and hours filters honored.

**Acceptance Scenarios**:

1. **Given** an address or postal code, **When** the user runs Locator, **Then** the node returns nearby service points / drop-off locations ordered by distance.
2. **Given** capability filters (e.g. holdForPickup, dangerousGoods, kiosk), **When** the user runs Locator, **Then** only matching locations are returned.

---

### Cross-Cutting Behavior (applies to all stories)

1. **Given** `continueOnFail` is enabled and one item in a batch is invalid, **Then** valid items still process and the failed item returns a structured error.
2. **Given** a transient carrier 5xx or throttle response mid-workflow, **Then** the node retries within bounds, then surfaces a clear error if still failing.
3. **Given** any operation, **When** it runs on the AI-Agent tool-execution path, **Then** it behaves identically to the normal execution path.

### Deferred Stories (v1.1, not in this scope)

- Create Shipment → returns PIN + printable label (Shipping API).
- Void Shipment → confirms cancellation (Shipping API).
- Validate Address → returns serviceability and corrections (Service Availability API).
- Get Documents / Label, Returns Management (Shipping API).

### Edge Cases

- Rate request for an unserviceable origin/destination pair.
- Tracking a PIN that does not exist or has aged out of the system.
- Voiding a pickup that has already been collected or already voided.
- Modifying a pickup whose status is not Scheduled/Dispatched.
- Transient carrier 5xx or throttle response mid-workflow (must retry within bounds, then surface a clear error).
- Multi-piece shipments: Tracking returns per-package detail within a shipment; Estimate rates at the shipment level. Supported in v1.
- International / US destinations: Estimate and Track support CA/US/INTL receivers; sender origin is Canada-only. Supported in v1 (customs document handling is a Shipping-API concern, deferred to v1.1).

## Requirements *(mandatory)*

Scope is set by what Purolator's REST API exposes today. The node integrates the REST API only. It does NOT integrate the legacy SOAP/WSDL web services to cover gaps. Exact field sets come from each API's OpenAPI document. v1 scopes `lineOfBusiness` to **Courier** / parcel — Freight is deferred.

### Functional Requirements — Operations (v1, live on REST now)

- **FR-001 — Estimate / Rate**: System MUST expose an Estimate operation backed by `POST /rate/v1/shipment`, returning eligible services with base price, surcharges (e.g. fuel), option prices, taxes, total, and transit days. A single call MUST return all eligible services (`showAlternativeServicesIndicator`, default true). Purolator still requires a "requested" `serviceId` to anchor the call even when shopping all rates, so the node exposes an optional **Primary Service** parameter defaulting to `PurolatorGround` (case-insensitive; ~60 service IDs available via dropdown); pinning a single service flips the alternatives indicator off. [VERIFY LIVE: whether an off-lane anchor service — e.g. `PurolatorGround` on a US/INTL lane — is ignored or rejected; if rejected, document "set Primary Service for non-domestic lanes."] Sender MUST be Canadian (`country=CA`); receiver MAY be CA/US/INTL. `displayPublishedRates` MUST toggle account vs published rates. Dimensions are optional for courier but all-three-or-none. Shipment and piece **options** (closed enums: 14 shipment-level option IDs such as AdultSignatureRequired, DeclaredValue, HoldForPickup, DangerousGoods/Class/Mode; piece-level SpecialHandling types) MUST be exposed as a **hybrid**: high-frequency options (signature, declared value, hold for pickup, residential signature, dangerous goods class/mode) as first-class typed parameters, plus a generic "Additional Options" `{optionId, optionIdValue}` collection for the long tail and future option IDs. The node assembles the carrier's option-pair list from these; the curated→pairs mapping is a unit-tested transform (Principle 10).
- **FR-004 — Track**: System MUST expose a Track operation backed by `POST /track/v1/shipment` (opId `getTrackingInfo`) accepting a batch array of search entries. The node models this as a per-entry **Tracking Items collection**: each entry has a required `trackingId` (PIN or shipment reference, max 35 chars) plus optional per-entry disambiguation — shipper account number, destination postal code, date range (`shipmentDateFrom`/`shipmentDateTo`), and `eventSortOrder` (a/d). Request-level: `language` (en/fr). Per-entry (confirmed against the live schema — `OnlineTrackingSearchRequest`): `pod` (`pod=true` MUST return the proof-of-delivery image in `deliveryDetails`). Reference searches matching multiple shipments MUST honor a per-entry date range or account number to disambiguate (US2.4); only a per-entry structure can disambiguate a heterogeneous batch. Per-package results MUST be returned for multi-piece shipments. [VERIFY LIVE: the enforced maximum number of PINs per request — surface the carrier's limit as a clear validation error once known.]
- **FR-007 — Pickup**: System MUST expose four pickup operations.
  - **Schedule** `POST /pickup/v1/schedule` requires: account number (FR-X-012), `contactInfo` (name + phone), pickup `Address`, `pickupInstructions` (date `YYYY-MM-DD`, time window `anyTimeAfter`/`untilTime` in 24-hour `HH:mm` meeting a minimum-duration threshold, `pickupLocation` from a carrier enum — FrontDesk, LoadingDock, Receiving, Shipping, Lobby, …, and `measurementUnit`), and a **`shipmentSummary` collection** (≥1 entry, defaulting to one) where each entry has a unique destination region (`destinationCode` ∈ DOM/USA/INTL), total pieces, total weight, and mode of transport (`Air`/`Ground`/`Air/Ground`). Weight units MUST be consistent across the request. Optional: `pickupNotificationEmail`, additional instructions, supply request codes.
  - **Modify** `PUT /pickup/v1/modify` (status must be Scheduled/Dispatched) can change only `untilTime`, `pickupLocation`, additional instructions, supply request codes, and shipment-summary weight/piece counts; `destinationCode` and the weight unit MUST NOT change after scheduling.
  - **Void** `PUT /pickup/v1/void` (status must be Scheduled/Dispatched) returns a `pickupVoided` boolean.
  - **Get History** `POST /pickup/v1/getHistory` accepts up to 50 confirmation numbers and filters by date range/status; a `204 No Content` (no matches) MUST surface as an empty success result, not an error (per FR-X-010).
  - `lineOfBusiness` MUST default to Courier. System MUST surface the carrier constraint that pickups cannot be scheduled from P.O. Box / Rural Route / Suburban Service / General Delivery addresses (carrier-enforced, passed through per FR-X-011).
- **FR-009 — Service Point (Locator)**: System MUST expose a **Service Point** operation (user-facing name; backed by `GET /locator/v1/address`, query-param based) requiring `language` and `requestReference`. Search inputs reuse the canonical `Address` fields (common case: postal code only). Supports typed optional filters: location type, service capability (holdForPickup, dangerousGoods, kiosk, streetAccess, wheelChairAccess), radius in kilometres (`radialDistanceInKm`), result count (`maxNumberOfLocations`), and hours (openTime/closeTime/currentlyOpen/daysOfOperation). Results MUST be ordered ascending by distance. Requires the Locator-only `x-origin-verify` / `access-control-allow-origin` headers (see FR-AUTH-006).

**Endpoint map (v1)** — feeds `/speckit-plan`:

| Operation | Method + path | Notes |
|-----------|---------------|-------|
| Auth (token) | `POST /auth/v1/token` | Basic auth; JSON body `grant_type`+`scope`; returns `expires_in` |
| Estimate | `POST /rate/v1/shipment` | `Language`, `RequestReference` optional headers |
| Track | `POST /track/v1/shipment` | batch array; `pod` flag |
| Pickup: Schedule | `POST /pickup/v1/schedule` | `Language` required header |
| Pickup: Modify | `PUT /pickup/v1/modify` | status must be Scheduled/Dispatched |
| Pickup: Void | `PUT /pickup/v1/void` | returns `pickupVoided` boolean |
| Pickup: History | `POST /pickup/v1/getHistory` | empty result when no matches |
| Locator | `GET /locator/v1/address` | query params; extra headers (see FR-AUTH-006) |

### Functional Requirements — Deferred to v1.1 (not yet on REST)

- **FR-002 — Create Shipment** (Shipping API): Register a domestic/US/international shipment and return its PIN plus label. Blocked: Shipping API not yet on REST.
- **FR-003 — Get Documents / Label** (Shipping API): Retrieve label and shipping documents for an existing shipment. Blocked with FR-002.
- **FR-005 — Void Shipment** (Shipping API): Cancel an unshipped shipment by PIN. Blocked with FR-002.
- **FR-006 — Validate Address** (Service Availability API): Confirm serviceability and return corrections. Blocked: not yet on REST.
- **FR-008 — Service Availability** (Service Availability API): List services/products available for an origin/destination. Blocked: not yet on REST.
- **FR-010 — Returns Management** (Shipping API): Create domestic returns shipments. Blocked with FR-002. Confirm returns is in REST Shipping API scope when it ships (see Assumptions).

**Scoping rationale**: Purolator is mid-migration from SOAP to REST. Building the deferred operations on SOAP now would mean a throwaway rewrite plus a breaking change for users once the REST equivalents land, and would force a second auth model and hand-rolled XML into an otherwise dependency-free OAuth/REST node. v1 ships the live REST endpoints; v1.1 adds Shipping and Service Availability when their REST APIs are released.

### Authentication Requirements

- **FR-AUTH-001**: A single dedicated credential type MUST hold `client_id`, `client_secret`, the `X-Api-Key`, an environment selector (production / sandbox) that MUST default to **sandbox**, and an **optional** `x-origin-verify` token used only by the Locator operation (see FR-AUTH-006), and an **optional default account number** — the user's Purolator account, non-secret convenience data, not part of the credential `test`, overridable per operation — that feeds both Estimate's `billingAccountNumber` and Pickup/History's `registeredAccountNumber` (see FR-X-012). One credential covers all v1 APIs (see FR-AUTH-007).
- **FR-AUTH-002**: The credential type MUST provide a test request that validates the credentials without running a billable operation (e.g. a token fetch).
- **FR-AUTH-003**: Token model (CONFIRMED): `POST /auth/v1/token` with HTTP Basic Authentication (`client_id`:`client_secret`, Base64 in the `Authorization` header) and a JSON body `{ "grant_type": "client_credentials", "scope": "portal_api" }`, both values exact. Returns `access_token`, `token_type` (Bearer), `expires_in` (seconds), `scope`. 401 on bad credentials; 400 on bad grant_type/scope.
- **FR-AUTH-004**: Token lifecycle (CONFIRMED): TTL is dynamic, read from `expires_in`. Auth is handled at the credential level: a custom credential type with a `preAuthentication` token fetch (JSON body + Basic header) caches the `access_token`, and an `authenticate` block injects `Authorization: Bearer <token>` + `x-api-key` on every request. The node relies on n8n's standard refresh-on-401 behavior (re-running `preAuthentication` when a request returns 401) rather than proactive pre-expiry refresh; proactive refresh is explicitly out of scope for v1. [CONFIRMED against schema: the token request body is `application/json`, not form-encoded OAuth2, so n8n's built-in OAuth2 client-credentials credential will NOT work as-is — the custom credential above is required. Still VERIFY LIVE that the live token endpoint accepts the JSON+Basic request.]
- **FR-AUTH-005**: API key (CONFIRMED): every API request MUST include a valid `X-Api-Key` header in addition to the Bearer token. It is provisioned separately from the OAuth credentials when creating an App in the portal. This is cross-cutting across all operations.
- **FR-AUTH-006**: Locator alone declares two extra required headers, `x-origin-verify` and `access-control-allow-origin`, that Estimate/Track/Pickup do not (confirmed against the schemas). The schema gives `x-origin-verify` a concrete token example, so it is treated as a real shared secret: it is an **optional** field on the single credential (FR-AUTH-001), injected only on Locator requests. `access-control-allow-origin` is a CORS response header and MUST NOT be a user-facing field; if live-verify proves it is genuinely enforced, the node injects a constant on the Locator request, otherwise it is omitted. [VERIFY LIVE: confirm whether Locator actually rejects requests missing `x-origin-verify` / `access-control-allow-origin`, and whether `x-origin-verify` is per-app or a published constant.]
- **FR-AUTH-007**: Credential cardinality (RESOLVED): all v1 endpoints share one `bearerAuth` scheme plus the same `X-Api-Key`; there is no per-API scope or entitlement split. The node is single-credential; the multi-credential `authentication`-param mechanism is NOT needed.
- **FR-AUTH-008**: Hosts (CONFIRMED): production `https://shipapi.purolator.com`, sandbox `https://shipapi-sandbox.purolator.com`. The environment selector on the credential switches the base URL.

### Cross-Cutting Requirements

- **FR-X-001**: All operations MUST honor `continueOnFail`.
- **FR-X-002**: Carrier fault codes and messages MUST be surfaced in n8n errors, never swallowed.
- **FR-X-003**: Transient failures (5xx / 429 throttle) MUST retry up to 3 total attempts with jittered exponential backoff (~1s base delay), and MUST honor a `Retry-After` header when the carrier supplies one. 4xx validation errors MUST NOT retry.
- **FR-X-004**: Secrets MUST never appear in logs, errors, or URLs.
- **FR-X-005**: Status values MUST be normalized to a documented, stable set, **and the raw carrier `statusCode`/`subCode` and description MUST always be passed through alongside** the normalized value (no data loss). The carrier publishes no status enum in its OAS, so unmapped codes MUST resolve to `Unknown` rather than failing. The normalized set is **additive-only** — values are added as new codes are observed, never renamed or removed — which is what makes it stable for downstream workflows. The Tracking normalized set is: `Created`, `InTransit`, `OutForDelivery`, `AttemptedDelivery`, `Delivered`, `HeldForPickup`, `Exception`, `ReturnToSender`, `Cancelled`, `Unknown`. The Pickup status set is separate and fixed: Scheduled, Dispatched, Cancelled, NoPickup, PickedUp, Pending. The concrete carrier-code → normalized-value mapping table is built from observed live responses and unit-tested first (Constitution Principle 10).
- **FR-X-006**: The node MUST be usable as an n8n AI-Agent tool and behave identically on the tool-execution path and the normal path. Every operation MUST be validated through both paths.
- **FR-X-007**: `X-Api-Key` and the Bearer token MUST be injected on every operation's request, sourced from the single credential (see FR-AUTH-005).
- **FR-X-008**: `Language` / `RequestReference` handling MUST be wired per endpoint: Estimate uses optional `Language`/`RequestReference` headers; Pickup requires a `Language` header; Locator takes `language`/`requestReference` as query params; Tracking takes `language` in the body. Do not assume one shared mechanism.
- **FR-X-009**: Multi-result operations (Estimate eligible services, Track entries, Locator locations) MUST expose a per-operation `Split Results` toggle. When enabled (the default), the node emits one n8n output item per result element; when disabled, it emits one item per input with the results as a nested array field. The toggle MUST behave identically on the normal and AI-Agent tool-execution paths (see FR-X-006). Under `continueOnFail`, a batch entry the carrier *rejects* MUST emit a per-item structured error regardless of the toggle; a batch entry the carrier *answers* with a negative result (e.g. a not-found PIN) is a normal success item, not an error (see FR-X-010).
- **FR-X-010**: Error vs result classification ("mirror the carrier"): a carrier **error response** (4xx/5xx, auth failure, validation rejection, malformed input) MUST surface as an n8n error — thrown, or a structured error item under `continueOnFail` — carrying the carrier fault code and message with secrets stripped (per FR-X-002, FR-X-004). A carrier **200 response with a negative payload** (a not-found PIN, empty Estimate services, empty pickup history) MUST surface as a normal **success item** carrying that negative result: a not-found PIN is an item with `found: false`, and empty service/location/history sets are empty arrays — never an n8n error. The unserviceable-lane case (US1.3) is a carrier error because Purolator returns an error response for it.
- **FR-X-011**: Validation posture — minimal and structural. The node validates locally ONLY: required-field presence needed to assemble a well-formed request, package dimensions all-three-or-none, and sender `country=CA` — each with a clear, actionable message because the equivalent carrier error would be confusing. All other business rules (serviceability, the 150 lb/68 kg per-piece cap, P.O. Box/Rural Route/General Delivery pickup constraints, batch-size caps) pass through to Purolator and surface via FR-X-010; the node MUST NOT re-implement the carrier rulebook (avoids drift). Per Constitution Principle 10, the local validation/transform helpers are unit-tested; Purolator's rules are not.
- **FR-X-012**: Account-number resolution — operations that need an account (Estimate's `billingAccountNumber`; Pickup Schedule/Modify and GetHistory's `registeredAccountNumber`) take it from an optional per-operation override, falling back to the credential's optional default account number (FR-AUTH-001). The split between `billingAccountNumber` and `registeredAccountNumber` is an API field-name artifact over one real-world account (cf. ADR-0005). If neither override nor default is set, the node MUST fail locally with a clear "account number required" message rather than sending an incomplete request.

### Key Entities

- **Address** — One canonical node-facing shape (`street`, `city`, `province`, `country`, `postalCode`, optional `companyName`) reused across operations; mapped internally to each API's native field names (Estimate `provinceStateCode`/`postalZipCode`, Pickup `province`/`postalCode`, Locator `provinceCode`/`postalCode`). See ADR-0005.
- **Contact** — Pickup contact (`name`, `phoneNumber`, optional company/extension), kept separate from Address; required to schedule a Pickup.
- **Shipment** — Origin, destination, package(s), service level, references; identified by PIN once created.
- **Package** — Shipment-level `Total Weight` + `Total Packages` are required and **explicit** (the node does not derive them from itemized pieces, to keep the user in control of billable weight). An optional per-piece collection carries each piece's weight (required if a piece is added) and `L/W/H` (all-three-or-none, locally validated per FR-X-011). `unitOfMeasurement` selects Imperial (lb/in) or Metric (kg/cm), defaulting to Imperial. Per-piece weight cap 150 lb / 68 kg is enforced by the carrier, not the node.
- **Estimate/Rate** — Service option with price and transit time.
- **Label/Document** — Printable artifact tied to a PIN (v1.1).
- **Tracking Event** — Timestamped status with location.
- **Pickup** — Date, ready time, location for a carrier collection; identified by a confirmation number.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can configure credentials once and complete a rate, track, schedule-pickup, and locate flow end to end across one or more workflows.
- **SC-002**: `npx @n8n/scan-community-package n8n-nodes-purolator` passes with zero errors.
- **SC-003**: The package declares zero runtime dependencies.
- **SC-004**: Every operation has at least one documented example in the README.
- **SC-005**: Invalid credentials and unserviceable lanes produce clear, actionable errors with no secret leakage.
- **SC-006**: The package builds, publishes via GitHub Actions with provenance, and is accepted for n8n verification.
- **SC-007**: Every operation is verified through both normal and AI-Agent tool execution paths in a Docker n8n harness with the package installed.

## Out of Scope (v1)

- Any carrier other than Purolator.
- The legacy SOAP/WSDL web services. The node integrates the REST API only.
- Shipment/label creation, returns, address validation, and service availability — deferred to v1.1 pending their REST release (FR-002, FR-003, FR-005, FR-006, FR-008, FR-010).
- The Estimate API's optional `returnShipment` cost-estimate block (return-label rating alongside the outbound estimate). v1 Estimate rates the outbound shipment only; return-shipment estimation rides with Returns in v1.1 (FR-010).
- Freight (`lineOfBusiness=Freight`). v1 is Courier / parcel only.
- Billing, invoicing, or account-management operations.

## Assumptions

- **Status normalization**: The requirement (FR-X-005) is satisfied by a documented, stable normalized status set. The full Tracking status/scan-code list is not encoded here; it is extracted from the Tracking OpenAPI document and Business Rules during `/speckit-plan` and may grow as live responses are observed. The Pickup status set is already known and fixed.
- **Returns scope (FR-010)**: Returns is assumed to ride with the REST Shipping API in v1.1; confirm with Purolator developer support when the Shipping REST API is released. This does not affect v1 scope.
- **Token encoding (FR-AUTH-004) — CONFIRMED LIVE (2026-06-15)**: a real call to the sandbox `POST /auth/v1/token` with HTTP Basic + JSON body `{"grant_type":"client_credentials","scope":"portal_api"}` returns **HTTP 200** with `token_type: Bearer`, `expires_in: 3600`, and granted `scope: portal_api_sandbox`. This confirms n8n's form-encoded OAuth2 helper cannot be used and the custom preAuthentication credential (ADR-0001) is required. `X-Api-Key` is NOT needed on the token call itself (only on downstream APIs).
- **Live data-plane verification BLOCKED (2026-06-15) — sandbox authorizer broken**: every authenticated call to the sandbox data-plane APIs (Estimate, Track, Locator) returns **HTTP 500 `x-amzn-ErrorType: AuthorizerConfigurationException`** from AWS API Gateway, *regardless of token validity* (a garbage Bearer token produces the identical 500; only omitting `Authorization` changes it to a clean 401). The failure is server-side — the sandbox Lambda authorizer errors on invocation before validating the token — not a request defect. Consequence: the remaining VERIFY-LIVE items below cannot be closed and require Purolator developer support (authorizer misconfiguration and/or app entitlement / usage-plan subscription for the data APIs). This is the Constitution Principle 12 entitlement/authorizer trap, confirmed real. **The same 500 reproduces on the production host (`https://shipapi.purolator.com`)**, and the production token endpoint still grants `scope: portal_api_sandbox` — i.e. the `.env.json` credentials are sandbox-scoped, so no production data-plane path is available to us either. (Incidental: a ~250-entry Track body is rejected by CloudFront/WAF with a 403 — an infra body-size limit, not the documented per-request PIN cap.)
- **Open VERIFY-LIVE items, blocked by the above** (carry into planning/implementation): (a) Locator `x-origin-verify` / `access-control-allow-origin` genuine enforcement and per-app-vs-constant nature; (b) Estimate off-lane anchor service (`PurolatorGround` on a US/INTL lane) ignored vs rejected; (c) Track enforced max PINs-per-request. We also have no `x-origin-verify` value in `.env.json`, so the Locator success path is untestable until one is provisioned.
- **Shipping/Service Availability timeline**: v1 ships now against live REST endpoints rather than waiting for the deferred APIs; v1.1 follows when those REST APIs are released.
- All v1 OpenAPI (OAS 3.0.x) documents and Business Rules pages for Authentication, Estimate, Tracking, Pickup, and Locator have been gathered and mapped into the requirements above. WSDL docs are not needed for v1.
- The constitution referenced by these requirements (zero-dependency REST-only node, `usableAsTool` parity, live-endpoint verification) is the governing project constitution; principle numbers cited in source notes are indicative pending the project constitution being finalized.
