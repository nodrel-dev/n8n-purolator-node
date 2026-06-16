# Phase 1 Data Model: Purolator Carrier Node

**Feature**: 001-purolator-node | **Date**: 2026-06-15

Node-facing entities (the shapes users and the AI-Agent see) and how each maps to the
carrier's native API fields. Node field names follow CONTEXT.md terminology; raw carrier names
are an internal mapping detail (ADR-0005). Validation columns mark **local** (structural,
FR-X-011) vs **carrier** (passthrough, surfaced via mirror-the-carrier ADR-0004 / FR-X-010).

## Conventions

- `unitOfMeasurement`: enum `Imperial` (lb/in) | `Metric` (kg/cm), default **Imperial**. Must be consistent within a request.
- All dates `YYYY-MM-DD`; times 24-hour `HH:mm` (pickup) / `HH:MM:SS` (locator hours).
- Secrets never appear in any entity emitted to the workflow (FR-X-004).

## Core reusable structures

### Address (canonical — ADR-0005)

| Node field | Type | Required | Local validation | Maps to (Estimate / Pickup / Locator) |
|------------|------|----------|------------------|----------------------------------------|
| `street` | string | yes (Pickup, Estimate); postal-only allowed (Locator) | presence when required | `streetAddress` / `address` (street) / `streetAddress` |
| `city` | string | yes (intl receiver, Pickup) | — | `city` / `city` / `city` |
| `province` | string | yes for CA/US (Estimate); req (Pickup) | — | `provinceStateCode` / `province` / `provinceCode` |
| `country` | string (ISO-2) | yes | sender MUST be `CA` (Estimate, FR-X-011) | `country` / (CA implied) / `country` |
| `postalCode` | string | yes (common Locator input) | — | `postalZipCode` / `postalCode` / `postalCode` |
| `companyName` | string | no | — | passthrough where supported |

> Sender `country=CA` is the only locally-enforced address rule; receiver may be CA/US/INTL. International receiver needs only `city` + `country` + `postalCode` (carrier rule, passthrough).

### Contact (Pickup only)

| Node field | Type | Required | Maps to |
|------------|------|----------|---------|
| `name` | string | yes | `contactInfo.contactName` |
| `phoneNumber` | string | yes | `contactInfo.phoneNumber` |
| `companyName` | string | no | `contactInfo.companyName` |
| `extension` | string | no | `contactInfo.phoneExtension` |

### Package (Estimate)

| Node field | Type | Required | Local validation |
|------------|------|----------|------------------|
| `totalWeight` | number | yes (explicit, not derived) | presence |
| `totalPackages` | integer | yes (explicit) | presence |
| `unitOfMeasurement` | enum | default Imperial | — |
| `pieces[]` | collection | no | if a piece is added, its `weight` is required |
| `pieces[].weight` | number | req if piece added | presence |
| `pieces[].length/width/height` | number | optional | **all-three-or-none** (FR-X-011) |

> 150 lb / 68 kg per-piece cap is carrier-enforced (passthrough), not local.

### AdditionalOption (generic option pair — FR-001 / R7)

| Node field | Type | Notes |
|------------|------|-------|
| `optionId` | string | carrier option ID (long-tail / future) |
| `optionIdValue` | string | required for value-bearing options (e.g. DangerousGoodsClass) |

## Operation request entities

### Estimate (`POST /rate/v1/shipment`)

| Node param | Type | Required | Default | Carrier mapping / notes |
|------------|------|----------|---------|--------------------------|
| `sender` (Address) | Address | yes | — | sender, `country=CA` (local) |
| `receiver` (Address) | Address | yes | — | receiver, CA/US/INTL |
| `package` (Package) | Package | yes | — | weight/pieces |
| `accountNumber` | string | resolved | credential default | `billingAccountNumber` (FR-X-012) |
| `primaryService` | options (~60 IDs) | no | `PurolatorGround` | requested `serviceId` anchor; pinning one flips alternatives off (VL-1) |
| `showAlternativeServices` | boolean | — | true | `showAlternativeServicesIndicator` |
| `displayPublishedRates` | boolean | — | false | account vs published rates |
| `shipmentDate` | date | no | today | `YYYY-MM-DD`, ≤10 days ahead (carrier) |
| `unitOfMeasurement` | enum | — | Imperial | |
| curated options | typed | no | — | signature, declared value, hold for pickup, residential signature, DG class/mode → option pairs (R7) |
| `additionalOptions[]` | AdditionalOption | no | — | long-tail option pairs |
| `splitResults` | boolean | — | true | shape eligible services (FR-X-009) |

> `Language` and `RequestReference` are sent as **optional request headers** for Estimate (not body params); wired per-endpoint per FR-X-008 (contrast Tracking's body `language` and Locator's query `language`/`requestReference`).

### Tracking (`POST /track/v1/shipment`)

Request-level: `language` (en/fr). Per-entry **Tracking Items** collection:

| Per-entry field | Type | Required | Notes |
|-----------------|------|----------|-------|
| `trackingId` | string (≤35) | yes | PIN or shipment reference |
| `accountNumber` | string | no | shipper acct (disambiguation) |
| `destinationPostalCode` | string | no | disambiguation |
| `shipmentDateFrom` / `shipmentDateTo` | date | no | date-range disambiguation (US2.4) |
| `eventSortOrder` | enum a/d | no | scan-event order |
| `pod` | boolean | no | true → POD image in `deliveryDetails` |

Request-level `splitResults` (default true). Max PINs/request = VL-2 (surface once known).

### Pickup — Schedule (`POST /pickup/v1/schedule`)

| Node param | Type | Required | Carrier mapping / notes |
|------------|------|----------|--------------------------|
| `accountNumber` | string | resolved | `registeredAccountNumber` (FR-X-012) |
| `lineOfBusiness` | enum | default **Courier** | Courier only in v1 |
| `contact` (Contact) | Contact | yes | `contactInfo` |
| `pickupAddress` (Address) | Address | yes | `pickupAddress`; no P.O. Box/Rural Route/General Delivery (carrier passthrough) |
| `date` | date | yes | `pickupInstructions.date` `YYYY-MM-DD` |
| `anyTimeAfter` / `untilTime` | time `HH:mm` | yes | window ≥ min duration (carrier) |
| `pickupLocation` | enum | yes | FrontDesk/LoadingDock/Receiving/Shipping/Lobby/… |
| `unitOfMeasurement` | enum | default Imperial | `measurementUnit`; consistent across request |
| `shipmentSummary[]` | collection (≥1, default 1) | yes | each: unique `destinationCode` ∈ DOM/USA/INTL, `totalPieces`, `totalWeight`, `modeOfTransport` ∈ Air/Ground/Air/Ground |
| `pickupNotificationEmail` | string | no | |
| `additionalInstructions` | string | no | |
| `supplyRequestCodes` | string[] | no | |

### Pickup — Modify (`PUT /pickup/v1/modify`)

Status must be Scheduled/Dispatched (carrier). Mutable only: `untilTime`, `pickupLocation`,
`additionalInstructions`, `supplyRequestCodes`, shipment-summary weight/piece counts.
`destinationCode` and weight unit **MUST NOT** change after scheduling (carrier). Requires
`pickupConfirmationNumber`.

### Pickup — Void (`PUT /pickup/v1/void`)

Inputs: `pickupConfirmationNumber`, `lineOfBusiness`. Status must be Scheduled/Dispatched.
Response: `pickupVoided` boolean.

### Pickup — Get History (`POST /pickup/v1/getHistory`)

| Node param | Type | Required | Notes |
|------------|------|----------|-------|
| `accountNumber` | string | resolved | `registeredAccountNumber` (FR-X-012) |
| `confirmationNumbers[]` | string[] | yes (≤50) | |
| `dateFrom` / `dateTo` | date | no | filter |
| `status` | enum | no | Pickup status set |

`204 No Content` → empty success result, not an error (FR-X-010).

### Service Point / Locator (`GET /locator/v1/address`, query params)

| Node param | Type | Required | Carrier mapping / notes |
|------------|------|----------|--------------------------|
| `language` | enum en/fr | yes | query |
| `requestReference` | string | yes | client trace id |
| search address | Address | yes (postal common) | `streetAddress`/`city`/`provinceCode`/`postalCode` |
| `locationType` | enum | no | shipping centre / retail / drop box / kiosk / locker / quick stop |
| `holdForPickup` `dangerousGoods` `kiosk` `streetAccess` `wheelChairAccess` | boolean | no | capability filters |
| `radialDistanceInKm` | number | no | |
| `maxNumberOfLocations` | integer | no | |
| `currentlyOpen` | boolean | no | hours filter |
| `openTime` / `closeTime` | time `HH:MM:SS` | no | |
| `daysOfOperation` | string (CSV) | no | |
| `gmtOffSet` | `HH:MM:SS` | no | |
| `splitResults` | boolean | — default true | shape locations |

Results ordered ascending by distance (carrier). Extra headers `x-origin-verify` /
`access-control-allow-origin` = VL-3 (injected only on Locator).

## Response / output entities

### Tracking result (per entry)

- `found` (boolean) — `false` for a not-found PIN (carrier 200, success item; ADR-0004).
- Shipment level: lead PIN, overall status, creation date, total pieces, product, shipper/receiver addresses, references, services.
- Package level (per piece): PIN, `statusCode`/`subCode` + description (**raw, always**), `normalizedStatus` (ADR-0003), ETA, transit days, induction date, last scan, full event history, weights, references, `deliveryDetails` (incl. POD image when `pod=true`), `holdForPickupLocationId`.
- Scan event: local timestamp, event code, reason code, description, terminal, route id, location, `xreference` (rerouted PIN).

### Estimate result

- One element per eligible service: `serviceId`/name, base price, surcharges (e.g. fuel), option prices, taxes, total, transit days. Empty set → empty array (success, ADR-0004).

### Pickup result

- Schedule → `pickupConfirmationNumber`. Modify → accepted/constraint. Void → `pickupVoided`. History → matching records or empty array. Status drawn from fixed set: `Scheduled, Dispatched, Cancelled, NoPickup, PickedUp, Pending`.

### Service Point result

- One element per location: id, name, address, distance, capabilities, hours, location type. Empty set → empty array.

### Error item (under `continueOnFail`)

- Structured: carrier fault `code` + `message`, operation, input ref — secrets stripped (FR-X-002/004). Only for carrier **error responses** (ADR-0004).

## State / status enums

- **Normalized Tracking status (additive-only, ADR-0003)**: `Created, InTransit, OutForDelivery, AttemptedDelivery, Delivered, HeldForPickup, Exception, ReturnToSender, Cancelled, Unknown`.
- **Pickup status (fixed)**: `Scheduled, Dispatched, Cancelled, NoPickup, PickedUp, Pending`.
- **Pickup destinationCode**: `DOM, USA, INTL`. **Mode of transport**: `Air, Ground, Air/Ground`.
</content>
