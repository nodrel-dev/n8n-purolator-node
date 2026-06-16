---
description: "Task list for Purolator Carrier Node implementation"
---

# Tasks: Purolator Carrier Node

**Input**: Design documents from `/specs/001-purolator-node/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Test tasks ARE included — Constitution Principle 10 mandates test-first for all
non-trivial transformation logic, and SC-007 requires both-path (normal + AI-Agent tool)
verification. Transform unit tests MUST be written and MUST FAIL before their implementation.
Carrier business rules are NOT unit-tested (FR-X-011) — only the node's own transforms.

**Organization**: Tasks grouped by user story (US1 Estimate → US2 Tracking → US3 Pickup →
US4 Service Point) for independent implementation and testing. Paths follow plan.md's
single-package layout (`credentials/`, `nodes/Purolator/`, `test/`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US4 for user-story phases; Setup/Foundational/Polish carry no story label

## Path Conventions

Single n8n community node package at repo root: `credentials/PurolatorApi.credentials.ts`,
`nodes/Purolator/{Purolator.node.ts, descriptions/, operations/, transforms/, transport/}`,
unit tests in `test/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the verified-node package skeleton and toolchain (research R11).

- [ ] T001 Scaffold the package with `n8n-node new` (declarative→programmatic conversion as needed) producing `credentials/` + `nodes/Purolator/` skeleton at repo root, package name `n8n-nodes-purolator`
- [ ] T002 Configure `package.json` (pnpm-only, version `0.1.0`, name `n8n-nodes-purolator`): zero runtime `dependencies` (Principle 2), `n8n.strict: true` (gotchas §5), `engines.node >= 22.22` (gotchas §5), scripts `build`/`lint`/`test`(vitest)/`release`(`n8n-node release`)/`prepublishOnly`(`n8n-node prerelease`) guard (gotchas §7), n8n node/credential registration block pointing at the node + `PurolatorApi` credential — must match the already-committed `release-please-config.json`/`.release-please-manifest.json`
- [ ] T003 [P] Configure `tsconfig.json` with `incremental: false` / no `tsBuildInfoFile`, target ES2022 (gotchas §7)
- [ ] T004 [P] Wire linting via `n8n-node lint` and confirm `npx @n8n/scan-community-package n8n-nodes-purolator` runs (SC-002, Principle 3)
- [ ] T005 [P] Add `vitest.config.mts` + `pnpm test` script with a `test/` directory (Principle 10)
- [ ] T006 [P] Add node icon `nodes/Purolator/purolator.svg`
- [ ] T007 [P] Create `README.md` skeleton with sections for each operation and the Address field-name mapping note (SC-004, ADR-0005)
- [ ] T008 [P] CI/CD is already committed (`.github/workflows/ci.yml` lint+test+build; `.github/workflows/publish.yml` release-please→npm OIDC Trusted Publishing w/ provenance; `release-please-config.json`; `.release-please-manifest.json`; `pnpm-workspace.yaml`). Verify it goes green once T001/T002 scaffold `package.json` + `pnpm-lock.yaml`, and register the npm Trusted Publisher against the `publish.yml` filename (Principle 9, gotchas §7)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Credential, auth-aware transport, shared pure transforms, and the node dispatcher
that EVERY user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Credential (contracts/credential.md, ADR-0001)

- [ ] T009 Define `PurolatorApi` credential fields in `credentials/PurolatorApi.credentials.ts` (clientId, clientSecret, apiKey, environment[default sandbox], optional xOriginVerify, optional defaultAccountNumber) with environment→baseURL switching (FR-AUTH-001/008)
- [ ] T010 Implement `preAuthentication` token fetch in `credentials/PurolatorApi.credentials.ts` — `POST {base}/auth/v1/token`, Basic header + JSON body `{grant_type:"client_credentials",scope:"portal_api"}`, cache `access_token` (FR-AUTH-003/004)
- [ ] T011 Implement the `authenticate` block injecting `Authorization: Bearer <token>` + `X-Api-Key` on every request in `credentials/PurolatorApi.credentials.ts` (FR-AUTH-005, FR-X-007)
- [ ] T012 Implement `ICredentialTestRequest` (token-fetch only, no billable call, independent of defaultAccountNumber/xOriginVerify) in `credentials/PurolatorApi.credentials.ts` (FR-AUTH-002, Principle 6)

### Transport (contracts/endpoint-map.md, FR-X-003)

- [ ] T013 [P] Write FAILING unit tests for bounded jittered backoff + `Retry-After` handling (≤3 attempts on 5xx/429, no 4xx retry) in `test/retry.test.ts` (Principle 10)
- [ ] T014 Implement `nodes/Purolator/transport/retry.ts` to pass T013 (FR-X-003)
- [ ] T015 Implement `nodes/Purolator/transport/request.ts` — `httpRequestWithAuthentication` wrapper applying retry + per-endpoint host/headers, with secrets never placed in URLs/logs (FR-X-004, FR-X-008)

### Shared transforms (test-first — Principle 10)

- [ ] T016 [P] Write FAILING tests for the canonical Address → per-endpoint field mapping in `test/address.test.ts` (ADR-0005)
- [ ] T017 [P] Implement `nodes/Purolator/transforms/address.ts` to pass T016 (Estimate/Pickup/Locator name mapping)
- [ ] T018 [P] Write FAILING tests for mirror-the-carrier error-vs-result classification in `test/classifyError.test.ts` (ADR-0004, FR-X-010)
- [ ] T019 [P] Implement `nodes/Purolator/transforms/classifyError.ts` to pass T018 (carrier error→n8n error w/ fault code, secrets stripped; 200 negative payload→success item)
- [ ] T020 [P] Write FAILING tests for the Split Results shaping (ON=item-per-result, OFF=nested array) in `test/splitResults.test.ts` (FR-X-009)
- [ ] T021 [P] Implement `nodes/Purolator/transforms/splitResults.ts` to pass T020
- [ ] T022 [P] Write FAILING tests for account-number resolution (override→credential default→fail) in `test/accountNumber.test.ts` (FR-X-012)
- [ ] T023 [P] Implement `nodes/Purolator/transforms/accountNumber.ts` to pass T022

### Node dispatcher

- [ ] T024 Implement the programmatic node skeleton in `nodes/Purolator/Purolator.node.ts` — `usableAsTool: true`, resource/operation routing, single-credential reference, the `continueOnFail` item loop wiring `classifyError` + `splitResults`, no gating credential on `operation` (ADR-0002, Principle 11)

**Checkpoint**: Foundation ready — user stories can now proceed (in parallel if staffed).

---

## Phase 3: User Story 1 - Estimate / Rate a Shipment (Priority: P1) 🎯 MVP

**Goal**: An Estimate operation that prices a shipment and returns eligible services with prices,
surcharges, taxes, and transit days from a single credential.

**Independent Test**: With a sandbox credential, run Estimate for a CA origin + CA/US/INTL
destination with ≥1 package; verify eligible services with base price, surcharges, taxes, total,
transit days; unserviceable lane → clear carrier error; invalid credentials → clear auth error
with no secret leak.

### Tests (test-first — Principle 10) ⚠️

- [ ] T025 [P] [US1] Write FAILING tests for the options transform (curated typed options + generic `{optionId,optionIdValue}` → carrier option-pair list) in `test/options.test.ts` (FR-001, research R7)
- [ ] T026 [P] [US1] Write FAILING tests for package validation (dimensions all-three-or-none, sender `country=CA`, required presence, piece weight required if piece added) in `test/packageValidation.test.ts` (FR-X-011)

### Implementation

- [ ] T027 [P] [US1] Implement `nodes/Purolator/transforms/options.ts` to pass T025
- [ ] T028 [P] [US1] Implement `nodes/Purolator/transforms/packageValidation.ts` to pass T026
- [ ] T029 [US1] Define Estimate UI parameters in `nodes/Purolator/descriptions/estimate.ts` (sender/receiver Address, Package, primaryService[default PurolatorGround], showAlternativeServices[default true], displayPublishedRates, shipmentDate, unitOfMeasurement, curated options, additionalOptions, accountNumber override, splitResults) per data-model.md
- [ ] T030 [US1] Implement the Estimate handler in `nodes/Purolator/operations/estimate.ts` — assemble `POST /rate/v1/shipment` body via address/options transforms + account resolution + sender-CA validation, optional `Language`/`RequestReference` headers, shape services via splitResults (FR-001, FR-X-008); document VL-1 default (keep PurolatorGround anchor)
- [ ] T031 [US1] Register Estimate resource/operation in the `Purolator.node.ts` dispatcher (depends on T024)
- [ ] T032 [US1] Verify Estimate end-to-end on BOTH normal and AI-Agent tool paths in the Docker `n8n execute --id` harness (SC-007, Principle 11; note data-plane VL blocker — run against contract mocks until carrier authorizer fixed)

**Checkpoint**: Estimate fully functional and independently testable — MVP candidate.

---

## Phase 4: User Story 2 - Track a Package (Priority: P2)

**Goal**: A Track operation accepting a batch of PINs/references returning current status
(raw + normalized), event history, and POD imagery, with per-PIN isolation.

**Independent Test**: Run Track on a known PIN → current status, `normalizedStatus` + raw code,
event history, POD when `pod=true`; batch with a not-found PIN → `found:false` success item
(batch not failed); reference matching multiple shipments without date range/account → carrier
disambiguation error.

### Tests (test-first — Principle 10) ⚠️

- [ ] T033 [P] [US2] Write FAILING tests for the status map (carrier `statusCode`/`subCode` → additive-only `normalizedStatus`, unmapped→`Unknown`, raw always preserved) in `test/statusMap.test.ts` (ADR-0003, FR-X-005)

### Implementation

- [ ] T034 [US2] Implement `nodes/Purolator/transforms/statusMap.ts` to pass T033
- [ ] T035 [US2] Define Tracking UI parameters in `nodes/Purolator/descriptions/tracking.ts` (request-level `language`; per-entry Tracking Items collection: trackingId[≤35], accountNumber, destinationPostalCode, shipmentDateFrom/To, eventSortOrder, pod; splitResults) per data-model.md
- [ ] T036 [US2] Implement the Track handler in `nodes/Purolator/operations/tracking.ts` — `POST /track/v1/shipment` with `language` in body, per-entry array, per-PIN result/error isolation under `continueOnFail`, emit raw + `normalizedStatus`, `found:false` for not-found, POD in `deliveryDetails`, shape via splitResults (FR-004, FR-X-008/009/010); enforce VL-2 max-PINs validation once known
- [ ] T037 [US2] Register Tracking resource/operation in the `Purolator.node.ts` dispatcher (depends on T024)
- [ ] T038 [US2] Verify Track end-to-end on BOTH normal and AI-Agent tool paths in the Docker harness, including batch with not-found PIN (SC-007, Principle 11)

**Checkpoint**: Estimate AND Tracking both work independently.

---

## Phase 5: User Story 3 - Schedule and Manage Pickups (Priority: P3)

**Goal**: Four pickup operations — Schedule, Modify, Void, Get History — for arranging and
managing carrier collection.

**Independent Test**: Schedule from a valid CA street address + date/window/location + ≥1
shipment summary → confirmation number; Modify a Scheduled/Dispatched pickup → accepted (else
status constraint); Void → `pickupVoided:true`; Get History (≤50) → records or empty success;
P.O. Box/Rural Route/General Delivery origin → carrier address constraint error.

### Tests (test-first — Principle 10) ⚠️

- [ ] T039 [P] [US3] Write FAILING tests for shipment-summary structural validation (≥1 entry, unique `destinationCode` ∈ DOM/USA/INTL, consistent weight unit, modeOfTransport enum) and Contact required-field presence in `test/pickupValidation.test.ts` (FR-007, FR-X-011)

### Implementation

- [ ] T040 [US3] Implement pickup structural validation + request assembly helpers in `nodes/Purolator/transforms/pickupValidation.ts` to pass T039 (reuses address.ts; Contact mapping per data-model.md)
- [ ] T041 [US3] Define Pickup UI parameters in `nodes/Purolator/descriptions/pickup.ts` for all four operations (Schedule: accountNumber, lineOfBusiness[default Courier], Contact, pickupAddress, date, anyTimeAfter/untilTime, pickupLocation enum, unitOfMeasurement, shipmentSummary collection, optional email/instructions/supplyRequestCodes; Modify: confirmation + mutable subset; Void: confirmation + lineOfBusiness; Get History: confirmationNumbers[≤50], dateFrom/To, status) per data-model.md
- [ ] T042 [US3] Implement the Pickup handlers in `nodes/Purolator/operations/pickup.ts` — `POST /schedule`, `PUT /modify`, `PUT /void`, `POST /getHistory` with required `Language` header; Modify blocks `destinationCode`/weight-unit changes; Void returns `pickupVoided`; Get History `204`→empty success item (FR-007, FR-X-008/010)
- [ ] T043 [US3] Register Pickup resource + 4 operations in the `Purolator.node.ts` dispatcher (depends on T024)
- [ ] T044 [US3] Verify all four Pickup operations on BOTH normal and AI-Agent tool paths in the Docker harness (SC-007, Principle 11)

**Checkpoint**: Estimate, Tracking, and Pickup all independently functional.

---

## Phase 6: User Story 4 - Locate Service Points (Priority: P4)

**Goal**: A Service Point operation returning nearby Purolator locations ordered by distance,
with capability and hours filters.

**Independent Test**: Run Service Point for a postal code → nearby locations ascending by
distance; capability filters (holdForPickup/dangerousGoods/kiosk) → only matching locations.

### Implementation

- [ ] T045 [US4] Define Service Point UI parameters in `nodes/Purolator/descriptions/servicePoint.ts` (language, requestReference, search Address[postal common], locationType, capability booleans, radialDistanceInKm, maxNumberOfLocations, hours filters, splitResults) per data-model.md
- [ ] T046 [US4] Implement the Service Point handler in `nodes/Purolator/operations/servicePoint.ts` — `GET /locator/v1/address` with query params, inject Locator-only `x-origin-verify` from credential (and conditional `access-control-allow-origin` per VL-3), results ascending by distance, shape via splitResults (FR-009, FR-AUTH-006, FR-X-008/009)
- [ ] T047 [US4] Register Service Point resource/operation in the `Purolator.node.ts` dispatcher (depends on T024)
- [ ] T048 [US4] Verify Service Point on BOTH normal and AI-Agent tool paths in the Docker harness (SC-007, Principle 11)

**Checkpoint**: All four user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verification, docs, and release readiness across all stories.

- [ ] T049 [P] Add ≥1 worked README example per operation incl. the Address field-name mapping note (SC-004, ADR-0005)
- [ ] T050 [P] Document the open live-verification items (VL-1 Estimate off-lane anchor, VL-2 Track max PINs, VL-3 Locator headers) and the data-plane authorizer blocker in README/CONTEXT as a pre-publish gate (Principle 12)
- [ ] T051 Run `npx @n8n/scan-community-package n8n-nodes-purolator` and resolve to zero errors (SC-002, Principle 3)
- [ ] T052 Run `npm pack --dry-run` and confirm the tarball is LICENSE + README + dist only (gotchas §7, SC-003)
- [ ] T053 Run the full quickstart.md validation (all 5 scenarios, both execution paths) in the Docker harness (SC-001/005/007)
- [ ] T054 Close VL-1/VL-2/VL-3 with Purolator developer support against the live data-plane, then flip documented-default behaviours if confirmation differs (Principle 12 — hard pre-publish gate)
- [ ] T055 Cut the first release: register the npm Trusted Publisher against `publish.yml`, then either let release-please's release PR drive the tag or use the `workflow_dispatch` escape hatch for the initial `0.1.0`; publish ships via OIDC with provenance. Submit for n8n verification (SC-006, Principle 9)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3–6)**: All depend on Foundational. Then independent — can run in parallel (if staffed) or sequentially P1→P2→P3→P4.
- **Polish (Phase 7)**: Depends on the desired user stories being complete.

### User Story Dependencies

- **US1 Estimate (P1)**: After Foundational — no dependency on other stories. MVP.
- **US2 Tracking (P2)**: After Foundational — independent (adds statusMap).
- **US3 Pickup (P3)**: After Foundational — independent (adds pickupValidation; reuses address).
- **US4 Service Point (P4)**: After Foundational — independent (adds x-origin-verify injection).

### Within Each User Story

- Transform unit tests MUST be written and FAIL before implementation (Principle 10).
- Transforms → description (UI) → operation handler → dispatcher registration → both-path verify.
- Dispatcher registration (T031/T037/T043/T047) all depend on the node skeleton T024.

### Parallel Opportunities

- Setup [P] tasks T003–T008 run together.
- Foundational [P] tasks: T013/T016/T018/T020/T022 (tests) and T017/T019/T021/T023 (impls, each after its test) across different files.
- Once Foundational completes, US1–US4 can be developed in parallel by different developers.
- Within US1: T025/T026 (tests) parallel; T027/T028 (impls) parallel.

---

## Parallel Example: Foundational shared transforms

```bash
# Write all failing transform tests together (different files):
Task: "FAILING tests for address mapping in test/address.test.ts"
Task: "FAILING tests for classifyError in test/classifyError.test.ts"
Task: "FAILING tests for splitResults in test/splitResults.test.ts"
Task: "FAILING tests for accountNumber in test/accountNumber.test.ts"

# Then implement each to green (different files):
Task: "Implement nodes/Purolator/transforms/address.ts"
Task: "Implement nodes/Purolator/transforms/classifyError.ts"
Task: "Implement nodes/Purolator/transforms/splitResults.ts"
Task: "Implement nodes/Purolator/transforms/accountNumber.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational (CRITICAL) → 3. Phase 3 Estimate → 4. STOP & validate Estimate independently (both paths) → 5. Demo MVP.

### Incremental Delivery

Setup + Foundational → US1 Estimate (MVP) → US2 Tracking → US3 Pickup → US4 Service Point.
Each story tested independently and adds value without breaking prior stories. The publish gate
(T051–T055) — especially the live-verification items (T054, Principle 12) — applies once before npm release.

---

## Notes

- [P] = different files, no incomplete dependencies. [Story] = traceability to spec user stories.
- Carrier business rules are passthrough (FR-X-011) and NOT unit-tested; only the node's own transforms are.
- Verify each transform test fails before implementing (Principle 10).
- Data-plane live calls are currently blocked by a carrier authorizer bug; use contract mocks for harness runs until T054 clears it. The token path is confirmed live.
- Commit after each task or logical group; never log/echo/URL-embed secrets (Principle 6, FR-X-004).
