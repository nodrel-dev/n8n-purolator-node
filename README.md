# n8n-nodes-purolator

An [n8n community node](https://docs.n8n.io/integrations/community-nodes/) for the
[Purolator](https://www.purolator.com/) REST API. Estimate rates, track shipments, schedule
pickups, and find service points directly against your own Purolator account — no custom HTTP
requests, no hand-rolled auth.

> **Status:** v0.1 (MVP). The **Estimate** operation is implemented. Tracking, Pickup, and
> Service Point are on the roadmap (see [the plan](specs/001-purolator-node/plan.md)).

[![CI](https://github.com/nodrel-dev/n8n-purolator-node/actions/workflows/ci.yml/badge.svg)](https://github.com/nodrel-dev/n8n-purolator-node/actions/workflows/ci.yml)

## Installation

In n8n: **Settings → Community Nodes → Install**, then enter `n8n-nodes-purolator`.

This node is also usable as an **AI-Agent tool** (`usableAsTool` is enabled).

## Credentials

Create a **Purolator API** credential with the API App values from the
[Purolator API Portal](https://devportal.purolator.com/):

| Field | Required | Notes |
|-------|----------|-------|
| Environment | yes | **Sandbox** (default) or **Production**. Switches the base URL. |
| Client ID | yes | OAuth client ID (HTTP Basic username for the token call). |
| Client Secret | yes | OAuth client secret (HTTP Basic password). |
| API Key | yes | The `X-Api-Key` sent on every request. |
| Origin Verify Token | no | Only needed by Service Point (Locator). Leave blank otherwise. |
| Default Account Number | no | Fallback account number for Estimate billing and Pickup. |

The credential authenticates with a token fetch against `POST /auth/v1/token` (JSON body +
HTTP Basic) and injects `Authorization: Bearer <token>` + `X-Api-Key` on every request. Tokens
refresh automatically on a 401. Click **Test** to validate.

> **Security:** secrets live only in n8n's encrypted credential store. They never appear in logs,
> errors, or URLs. See [SECURITY.md](./SECURITY.md).

## Operations

### Estimate

Prices a shipment and returns the eligible services with prices, surcharges, taxes, and transit
days (`POST /rate/v1/shipment`, Courier line of business).

**Example** — rate a 5 lb parcel from Ontario to British Columbia:

1. Add a **Purolator** node, Resource **Estimate**, Operation **Estimate**.
2. **Sender** → Street `123 Main St`, City `Mississauga`, Province `ON`, Country `CA`, Postal `L4W5M8`.
3. **Receiver** → City `Vancouver`, Province `BC`, Country `CA`, Postal `V6B1A1`.
4. **Total Weight** `5`, **Total Packages** `1`, **Unit of Measurement** `Imperial`.
5. Leave **Primary Service** as `PurolatorGround` and **Show Alternative Services** on to compare all services.
6. Set **Account Number** (or a Default Account Number on the credential).

With **Split Results** on (the default) the node emits one item per eligible service; turn it off
to receive all services as an array on a single item.

Common options (signature, declared value, hold for pickup, dangerous goods) are first-class
fields under **Options**; any other/future option ID can be supplied under **Additional Options**
as a raw `optionId` / `optionIdValue` pair.

## Address fields

The node uses one canonical address shape (`Street`, `City`, `Province / State Code`, `Country`,
`Postal / ZIP Code`, `Company Name`) across operations. These map internally to each Purolator
API's native field names (e.g. Estimate's `provinceStateCode` / `postalZipCode`) — see
[ADR-0005](./docs/adr/0005-unified-address-model.md). The sender must be Canadian (`CA`).

## Development

```bash
pnpm install
pnpm dev      # run n8n locally with the node loaded (live reload)
pnpm lint     # n8n-node lint (strict + cloud-compat)
pnpm test     # vitest unit tests for the pure transforms
pnpm build    # compile to dist/
```

See [CONTRIBUTING.md](./CONTRIBUTING.md). Releases are automated by release-please and published
to npm with provenance.

## License

[MIT](./LICENSE)
