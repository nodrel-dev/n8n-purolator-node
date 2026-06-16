# Feature Specification: Purolator Carrier Node

**Feature Branch**: `001-purolator-node`

**Created**: 2026-06-15

**Status**: Draft — REST-only v1 scope locked; all v1 OpenAPI specs + business rules gathered and mapped; ready for `/speckit-plan`

**Input**: User description: "Automate Purolator shipping operations from within n8n workflows — a verified community node exposing Purolator's core carrier operations (estimate, track, pickup, locator) as first-class n8n actions with managed credentials."

## Overview

n8n users who ship with Purolator currently have no native or community node. They hand-build raw HTTP requests, manage authentication manually, and re-implement carrier error handling in every workflow. This feature delivers a verified community node that exposes Purolator's core carrier operations as first-class n8n actions with managed credentials, scoped to what Purolator's REST API exposes today.

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

1. **Given** an origin and a date, **When** the user runs Schedule Pickup, **Then** the node confirms the pickup and returns its identifier.
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

- **FR-001 — Estimate / Rate**: System MUST expose an Estimate operation backed by `POST /rate/v1/shipment`, returning eligible services with base price, surcharges (e.g. fuel), option prices, taxes, total, and transit days. A single call MUST return all eligible services (`showAlternativeServicesIndicator`, default true). Sender MUST be Canadian (`country=CA`); receiver MAY be CA/US/INTL. `displayPublishedRates` MUST toggle account vs published rates. Dimensions are optional for courier but all-three-or-none.
- **FR-004 — Track**: System MUST expose a Track operation backed by `POST /track/v1/shipment` (opId `getTrackingInfo`) accepting a batch array of search entries, each with a `trackingId` (PIN or shipment reference, max 35 chars). `pod=true` MUST return the proof-of-delivery image in `deliveryDetails`. System MUST support `language` (en/fr) and `eventSortOrder` (a/d). Reference searches matching multiple shipments MUST honor a date range or account number to disambiguate. Per-package results MUST be returned for multi-piece shipments.
- **FR-007 — Pickup**: System MUST expose four pickup operations: Schedule `POST /pickup/v1/schedule`, Modify `PUT /pickup/v1/modify` (status must be Scheduled/Dispatched), Void `PUT /pickup/v1/void` (returns `pickupVoided` boolean), and Get History `POST /pickup/v1/getHistory` (up to 50 confirmation numbers; empty result when none match). `lineOfBusiness` MUST default to Courier. System MUST surface the carrier constraint that pickups cannot be scheduled from P.O. Box / Rural Route / General Delivery addresses.
- **FR-009 — Locator**: System MUST expose a Locator operation backed by `GET /locator/v1/address` (query-param based), requiring `language` and `requestReference`, and supporting filters by location type, service capability (holdForPickup, dangerousGoods, kiosk, streetAccess, wheelChairAccess), radius, count, and hours. Results MUST be ordered ascending by distance.

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

- **FR-AUTH-001**: A single dedicated credential type MUST hold `client_id`, `client_secret`, the `X-Api-Key`, and an environment selector (production / sandbox). One credential covers all v1 APIs (see FR-AUTH-007).
- **FR-AUTH-002**: The credential type MUST provide a test request that validates the credentials without running a billable operation (e.g. a token fetch).
- **FR-AUTH-003**: Token model (CONFIRMED): `POST /auth/v1/token` with HTTP Basic Authentication (`client_id`:`client_secret`, Base64 in the `Authorization` header) and a JSON body `{ "grant_type": "client_credentials", "scope": "portal_api" }`, both values exact. Returns `access_token`, `token_type` (Bearer), `expires_in` (seconds), `scope`. 401 on bad credentials; 400 on bad grant_type/scope.
- **FR-AUTH-004**: Token lifecycle (CONFIRMED): TTL is dynamic, read from `expires_in`. The node MUST cache the token and refresh proactively before expiry rather than waiting for a 401. [VERIFY LIVE: the OpenAPI declares the token request body as application/json, not form-encoded OAuth2. n8n's built-in OAuth2 client-credentials credential sends form-encoded token requests, so it likely will NOT work as-is. Plan for a custom credential type with a preAuthentication token fetch (JSON body + Basic header) plus per-request header injection. Confirm against the live token endpoint.]
- **FR-AUTH-005**: API key (CONFIRMED): every API request MUST include a valid `X-Api-Key` header in addition to the Bearer token. It is provisioned separately from the OAuth credentials when creating an App in the portal. This is cross-cutting across all operations.
- **FR-AUTH-006**: Locator declares two extra required headers, `x-origin-verify` and `access-control-allow-origin`, that the other APIs do not. [VERIFY LIVE: these read like AWS API-Gateway / CORS plumbing. Test whether Locator genuinely rejects requests without them, or whether the spec over-declares. If real, `x-origin-verify` MUST be a credential field.]
- **FR-AUTH-007**: Credential cardinality (RESOLVED): all v1 endpoints share one `bearerAuth` scheme plus the same `X-Api-Key`; there is no per-API scope or entitlement split. The node is single-credential; the multi-credential `authentication`-param mechanism is NOT needed.
- **FR-AUTH-008**: Hosts (CONFIRMED): production `https://shipapi.purolator.com`, sandbox `https://shipapi-sandbox.purolator.com`. The environment selector on the credential switches the base URL.

### Cross-Cutting Requirements

- **FR-X-001**: All operations MUST honor `continueOnFail`.
- **FR-X-002**: Carrier fault codes and messages MUST be surfaced in n8n errors, never swallowed.
- **FR-X-003**: Transient failures (5xx/throttle) MUST retry with bounded backoff; 4xx validation errors MUST NOT retry.
- **FR-X-004**: Secrets MUST never appear in logs, errors, or URLs.
- **FR-X-005**: Status values MUST be normalized to a documented, stable set. The known Pickup status set is Scheduled, Dispatched, Cancelled, NoPickup, PickedUp, Pending; the concrete Tracking status/scan-code mapping table is derived from the Tracking OAS and Business Rules during planning (see Assumptions).
- **FR-X-006**: The node MUST be usable as an n8n AI-Agent tool and behave identically on the tool-execution path and the normal path. Every operation MUST be validated through both paths.
- **FR-X-007**: `X-Api-Key` and the Bearer token MUST be injected on every operation's request, sourced from the single credential (see FR-AUTH-005).
- **FR-X-008**: `Language` / `RequestReference` handling MUST be wired per endpoint: Estimate uses optional `Language`/`RequestReference` headers; Pickup requires a `Language` header; Locator takes `language`/`requestReference` as query params; Tracking takes `language` in the body. Do not assume one shared mechanism.

### Key Entities

- **Shipment** — Origin, destination, package(s), service level, references; identified by PIN once created.
- **Package** — Weight, dimensions, declared value. `unitOfMeasurement` selects Imperial (lb/in) or Metric (kg/cm), defaulting to Imperial; dimensions are all-three-or-none for courier. Per-piece weight cap 150 lb / 68 kg.
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
- Freight (`lineOfBusiness=Freight`). v1 is Courier / parcel only.
- Billing, invoicing, or account-management operations.

## Assumptions

- **Status normalization**: The requirement (FR-X-005) is satisfied by a documented, stable normalized status set. The full Tracking status/scan-code list is not encoded here; it is extracted from the Tracking OpenAPI document and Business Rules during `/speckit-plan` and may grow as live responses are observed. The Pickup status set is already known and fixed.
- **Returns scope (FR-010)**: Returns is assumed to ride with the REST Shipping API in v1.1; confirm with Purolator developer support when the Shipping REST API is released. This does not affect v1 scope.
- **Token encoding (FR-AUTH-004)** and **Locator extra headers (FR-AUTH-006)** carry VERIFY-LIVE markers to be confirmed against the live endpoints during planning/implementation; the spec assumes a custom credential with preAuthentication token fetch is required.
- **Shipping/Service Availability timeline**: v1 ships now against live REST endpoints rather than waiting for the deferred APIs; v1.1 follows when those REST APIs are released.
- All v1 OpenAPI (OAS 3.0.x) documents and Business Rules pages for Authentication, Estimate, Tracking, Pickup, and Locator have been gathered and mapped into the requirements above. WSDL docs are not needed for v1.
- The constitution referenced by these requirements (zero-dependency REST-only node, `usableAsTool` parity, live-endpoint verification) is the governing project constitution; principle numbers cited in source notes are indicative pending the project constitution being finalized.
