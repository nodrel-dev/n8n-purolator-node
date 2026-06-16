# Contract: Carrier Endpoint Map (v1)

**Feature**: 001-purolator-node | **Date**: 2026-06-15

The live REST endpoints the node integrates. Hosts (FR-AUTH-008): production
`https://shipapi.purolator.com`, sandbox `https://shipapi-sandbox.purolator.com` (credential
default = **sandbox**). Every data-plane request carries `Authorization: Bearer <token>` +
`X-Api-Key` (FR-X-007). REST/JSON only — no SOAP (Principle 2).

| Operation (user-facing) | Method + path | Body/params | Per-endpoint headers | Notes |
|-------------------------|---------------|-------------|----------------------|-------|
| Auth (token) | `POST /auth/v1/token` | JSON `{grant_type:"client_credentials", scope:"portal_api"}`; HTTP Basic | — | Returns `access_token`/`token_type`/`expires_in`/`scope`. **No** `X-Api-Key` on token call. CONFIRMED LIVE. |
| Estimate | `POST /rate/v1/shipment` | JSON body | optional `Language`, `RequestReference` | `lineOfBusiness=Courier`; alternatives default on. |
| Tracking | `POST /track/v1/shipment` | JSON body (search-entry array) | `language` in body | per-PIN `searchResult`; `pod` flag. |
| Pickup: Schedule | `POST /pickup/v1/schedule` | JSON body | `Language` (required) | `lineOfBusiness=Courier`. |
| Pickup: Modify | `PUT /pickup/v1/modify` | JSON body | `Language` (required) | status ∈ Scheduled/Dispatched. |
| Pickup: Void | `PUT /pickup/v1/void` | JSON body | `Language` (required) | returns `pickupVoided`. |
| Pickup: Get History | `POST /pickup/v1/getHistory` | JSON body | `Language` (required) | ≤50 confirmations; `204` → empty success. |
| Service Point (Locator) | `GET /locator/v1/address` | query params | `language`/`requestReference` as query; extra `x-origin-verify` / `access-control-allow-origin` (VL-3) | results ascending by distance. |

## Header handling (FR-X-008 — wired per endpoint, no shared assumption)

- **Estimate**: `Language`/`RequestReference` = optional **headers**.
- **Tracking**: `language` in the **body**.
- **Pickup**: `Language` = required **header**.
- **Service Point**: `language`/`requestReference` = **query params**; plus Locator-only `x-origin-verify` (optional credential field) and conditional `access-control-allow-origin` (VL-3).

## Retry contract (FR-X-003)

Applies to all data-plane calls: ≤3 total attempts on **5xx / 429**, jittered exponential
backoff (~1s base), honor `Retry-After` when present. **No** retry on 4xx. Auth refresh on 401
is handled by the credential layer (re-run `preAuthentication`), separate from this retry.

## Live status (Principle 12)

- Token endpoint: ✅ CONFIRMED LIVE (200, `scope: portal_api_sandbox`).
- Data-plane (Estimate/Track/Locator/Pickup): ⛔ BLOCKED — HTTP 500 `AuthorizerConfigurationException` (carrier authorizer bug). Endpoints coded to mapped OpenAPI contracts; live confirmation (VL-1..3) required before publish.
</content>
