# Contract: Purolator Node Operations (UI surface)

**Feature**: 001-purolator-node | **Date**: 2026-06-15

The node's user-facing contract: one programmatic node (`usableAsTool: true`, ADR-0002,
Principle 11) with four resources. Param shapes are detailed in [data-model.md](../data-model.md);
this is the operation/resource map and the cross-cutting behaviour every operation honors.

## Resources & operations

| Resource (user-facing) | Operation(s) | Backing endpoint |
|------------------------|--------------|------------------|
| **Estimate** | Estimate | `POST /rate/v1/shipment` |
| **Tracking** | Track | `POST /track/v1/shipment` |
| **Pickup** | Schedule, Modify, Void, Get History | `POST /pickup/v1/schedule`, `PUT /pickup/v1/modify`, `PUT /pickup/v1/void`, `POST /pickup/v1/getHistory` |
| **Service Point** | Find | `GET /locator/v1/address` |

User-facing naming follows CONTEXT.md: **Estimate** (not Rate/Quote), **Tracking** (not Trace),
**Pickup**, **Service Point** (not Locator). Raw API field names are never user-facing (ADR-0005).

## Cross-cutting behaviour contract (every operation)

| Behaviour | Contract | Source |
|-----------|----------|--------|
| Tool parity | Identical result on normal and AI-Agent tool paths; both tested | FR-X-006, Principle 11, SC-007 |
| `continueOnFail` | Honored; failed item → structured error, others proceed | FR-X-001 |
| Error vs result | Mirror the carrier: error *response* → n8n error; 200 negative payload → success item | ADR-0004, FR-X-010 |
| Retry | ≤3 attempts on 5xx/429, jittered backoff, honor `Retry-After`; no 4xx retry | FR-X-003 |
| Secrets | Never in logs/errors/URLs | FR-X-004 |
| Auth injection | Bearer + `X-Api-Key` on every request from the one credential | FR-X-007 |
| Account number | per-op override → credential default → fail locally "account number required" | FR-X-012 |
| Local validation | structural only (presence, dims all-three-or-none, sender CA); rest passthrough | FR-X-011 |

## Split Results contract (multi-result ops: Estimate, Tracking, Service Point)

- Per-operation `Split Results` boolean toggle.
- **ON (default)**: one n8n output item per result element (service / track entry / location).
- **OFF**: one item per input, results as a nested array field.
- Identical on normal and tool paths (FR-X-009).
- Under `continueOnFail`: a carrier-**rejected** batch entry → structured error regardless of toggle; a carrier-**answered** negative (not-found PIN, empty set) → normal success item.

## Status output contract (Tracking)

Every package result emits **both** the raw carrier `statusCode`/`subCode`/description **and**
`normalizedStatus` from the additive-only set; unmapped → `Unknown` (never an error). Pickup uses
its separate fixed status set. (ADR-0003, FR-X-005)

## Transform contract (unit-tested first — Principle 10)

These pure transforms are the tested core; tests precede implementation:
`address` (canonical → per-endpoint), `statusMap`, `options` (curated + generic → option pairs),
`packageValidation`, `accountNumber` resolution, `splitResults`, `classifyError`,
`retry`/backoff. Carrier business rules are NOT re-implemented or tested (FR-X-011).
</content>
