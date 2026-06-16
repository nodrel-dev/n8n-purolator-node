# Contract: `PurolatorApi` Credential Type

**Feature**: 001-purolator-node | **Date**: 2026-06-15

A single custom n8n credential type covering all v1 APIs (FR-AUTH-001/007, ADR-0001).

## Fields

| Field | Type | Secret | Required | Default | Notes |
|-------|------|--------|----------|---------|-------|
| `clientId` | string | yes | yes | — | OAuth `client_id` (Basic username) |
| `clientSecret` | string (password) | yes | yes | — | OAuth `client_secret` (Basic password) |
| `apiKey` | string (password) | yes | yes | — | `X-Api-Key` on every data-plane request |
| `environment` | options `production`/`sandbox` | no | yes | **sandbox** | switches base URL (FR-AUTH-008) |
| `xOriginVerify` | string (password) | yes | **no** | — | Locator-only `x-origin-verify` (FR-AUTH-006, VL-3) |
| `defaultAccountNumber` | string | no | no | — | non-secret convenience; feeds Estimate `billingAccountNumber` + Pickup `registeredAccountNumber` (FR-X-012); overridable per operation; **not** part of the credential test |

## `preAuthentication` (token fetch — ADR-0001)

- `POST {base}/auth/v1/token`
- Headers: `Authorization: Basic base64(clientId:clientSecret)`, `Content-Type: application/json`
- Body: `{"grant_type":"client_credentials","scope":"portal_api"}`
- On success: cache `access_token` (TTL from `expires_in`).
- No `X-Api-Key` on the token call (CONFIRMED LIVE).

## `authenticate` block (per-request injection)

- `Authorization: Bearer <cached access_token>`
- `X-Api-Key: <apiKey>`
- (`x-origin-verify` is injected by the **Locator operation**, not globally, since only Locator needs it.)

## Token lifecycle

- TTL dynamic from `expires_in` (live: 3600s).
- Refresh = n8n's standard **refresh-on-401** (re-run `preAuthentication`). No proactive pre-expiry refresh (ADR-0001 relaxes FR-AUTH-004's literal wording).

## `ICredentialTestRequest` (FR-AUTH-002, Principle 6)

- Validates credentials without a billable operation: a token fetch (the `preAuthentication` path) is sufficient — a 200 with a Bearer token = valid; 401 = bad `clientId`/`clientSecret`; 400 = bad grant/scope.
- The test does **not** depend on `defaultAccountNumber` or `xOriginVerify`.

## Secret hygiene (Principle 6, FR-X-004)

- No secret in logs, error messages, or URLs. Real secrets live only in gitignored `.env.local` / `.env.json`. Any leaked secret is **rotated** in the portal, not merely redacted.
