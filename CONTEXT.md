# n8n-nodes-purolator

A verified n8n community node exposing Purolator's REST carrier operations (estimate, track, pickup, service-point lookup) as first-class n8n actions with a managed credential.

## Language

### Operations (user-facing resources)

**Estimate**:
The operation that prices a shipment and returns eligible services with prices and transit times. Backed by the `/rate/v1/shipment` endpoint, but "Rate" is the endpoint name only — never the user-facing term.
_Avoid_: Rate, Quote (as user-facing labels)

**Tracking**:
The operation that returns a shipment's current status, event history, and (where available) proof-of-delivery imagery.
_Avoid_: Trace

**Pickup**:
A scheduled carrier collection from an origin, identified by a confirmation number. The resource grouping its four operations: Schedule, Modify, Void, Get History.
_Avoid_: Collection, Dispatch

**Service Point**:
A Purolator location where a customer can drop off or pick up parcels. The user-facing name for what the underlying API calls the "Locator."
_Avoid_: Locator (as user-facing label), Drop-off location, Depot

### Identifiers

**PIN**:
Purolator's package identifier returned at ship time and used to track a shipment. A tracking request accepts a PIN or a shipment reference as its `trackingId`.
_Avoid_: Tracking number (when the PIN specifically is meant)

### Structures

**Address**:
The node's single canonical address shape, reused across operations with consistent field names (`street`, `city`, `province`, `country`, `postalCode`, optional `companyName`). Each endpoint's native field names (Estimate's `provinceStateCode`, Pickup's `province`, Locator's `provinceCode`, etc.) are an internal mapping detail, not user-facing.
_Avoid_: provinceStateCode / provinceCode / postalZipCode (as user-facing labels — these are raw API names)

**Contact**:
The pickup contact — `name` and `phoneNumber` (optional company, extension) — kept separate from the Address. Required to schedule a Pickup.
_Avoid_: folding contact details into Address

### Status

**Normalized Status**:
The node's own stable, carrier-agnostic tracking status, emitted alongside the raw carrier code. The set is additive-only: `Created`, `InTransit`, `OutForDelivery`, `AttemptedDelivery`, `Delivered`, `HeldForPickup`, `Exception`, `ReturnToSender`, `Cancelled`, `Unknown`. Distinct from the fixed Pickup status set (Scheduled, Dispatched, Cancelled, NoPickup, PickedUp, Pending).
_Avoid_: Mapped status, Canonical status

**Unknown** (status):
The normalized status assigned when a carrier code has no mapping yet. A graceful fallback, never an error — the raw code is always preserved.
