<!--
SYNC IMPACT REPORT
==================
Version change: (template / unversioned) → 1.1.0
Rationale: Initial ratification authored directly at 1.1.0. The supplied
constitution already folds in the 1.1.0 amendment content (Principles 11 & 12
plus the inherited n8n-nodes-fedex engineering guardrails and the strengthened
Principle 6), so the live document is published at that version rather than
1.0.0. MINOR-level scope versus a bare 1.0.0 baseline because it adds whole
principles and a new guardrails section.

Modified principles: n/a (initial authored set)
Added sections:
  - Principles 1–12 (Single-Service Scope … Verify Against Live Behaviour)
  - Inherited Engineering Guardrails (from n8n-nodes-fedex)
  - Governance
  - Amendment Process (with version history table)
Removed sections: none

Templates / artifacts reviewed:
  ✅ .specify/templates/plan-template.md — "Constitution Check" gate is generic
     ([Gates determined based on constitution file]); no edit required, gates
     are derived at /speckit.plan time from this file.
  ✅ .specify/templates/spec-template.md — no hardcoded principle references.
  ✅ .specify/templates/tasks-template.md — no hardcoded principle references;
     test-first (Principle 10) and tool-path testing (Principle 11) are
     expressible with existing task categories.
  ✅ .specify/extensions.yml — only after_specify / after_plan hooks; no
     before/after_constitution hooks to run.

Follow-up TODOs: none. Ratification and last-amended dates set to 2026-06-15.
-->

# n8n-nodes-purolator Constitution

**Project:** A verified n8n community node integrating the Purolator carrier API.

Spec Kit constitution. Non-negotiable principles. Every `/speckit.specify`,
`/speckit.plan`, and `/speckit.tasks` artifact MUST comply.

## Core Principles

### Principle 1: Single-Service Scope (NON-NEGOTIABLE)

The package integrates exactly one third-party service: Purolator. No other
carrier, aggregator, or unrelated utility may be bundled. A Purolator trigger
node MAY ship alongside the main node, but nothing else. This exists because
n8n's verification gate rejects multi-service packages outright.

### Principle 2: Zero Runtime Dependencies (NON-NEGOTIABLE)

Verified community nodes are not permitted any run-time dependencies. All HTTP
calls MUST use n8n's built-in request helpers (`this.helpers.httpRequest` /
`httpRequestWithAuthentication`). No vendor SDK, no axios, no XML library, no
SOAP client may appear in `dependencies`. Dev-only dependencies (TypeScript,
linters, build tooling) are fine.

> RESOLVED: Purolator's current API is REST/JSON (OpenAPI 3.0.1, server
> `https://shipapi.purolator.com`), not the legacy SOAP E-Ship Web Services.
> The XML-without-a-dependency concern is therefore moot. Standard JSON
> request/response handling through n8n's built-in helpers satisfies this
> principle cleanly. Do NOT integrate the old SOAP `eship.purolator.com`
> endpoints.

### Principle 3: TypeScript + n8n Guidelines + Linter Clean (NON-NEGOTIABLE)

Written in TypeScript, following n8n's node development guidelines. The package
MUST pass `npx @n8n/scan-community-package n8n-nodes-purolator` with zero
errors. Build the package with the `n8n-node` CLI tool (`n8n-node new`) so
structure and metadata match verification requirements from the start.

### Principle 4: English-Only Interface and Documentation

All parameter names, descriptions, help text, error messages, and README
content MUST be in English only. No exceptions.

### Principle 5: Declarative Style Preferred

Default to the declarative (routing-based) node style. Drop to programmatic
style only for operations the declarative style genuinely cannot express (e.g.
multi-step label retrieval, polling). Any such exception MUST be documented in
the plan.

### Principle 6: Credentials Are First-Class and Never Hardcoded

Authentication is handled through a dedicated n8n credential type, never inline
in the node. The credential type MUST implement a `test` request
(`ICredentialTestRequest`) so users can validate their credentials before
running a workflow. No secret values are logged, echoed in error messages,
placed in URL query strings, or hardcoded in docs, demo scripts, or review
videos. If a secret ever lands in any committed or pushed file, it MUST be
rotated in the Purolator portal, not merely redacted (git retains orphaned
commits by SHA until GC). Real secrets live only in a gitignored `.env.local`.
(gotchas §10)

### Principle 7: Production-Grade Error Handling

Every operation MUST map carrier API errors to clear, actionable n8n error
messages. Honor `continueOnFail`. Surface Purolator fault codes and messages
rather than swallowing them. Respect documented rate limits and implement
bounded retry with backoff on transient (5xx / throttle) responses. No retries
on 4xx validation errors.

### Principle 8: No Competition With n8n Paid Features

The node MUST NOT replicate or compete with n8n's paid or enterprise
functionality. Scope stays strictly within Purolator carrier operations.

### Principle 9: Provenance Publishing

The package is published to npm via a GitHub Actions workflow with a provenance
statement (required for verification submissions from May 1, 2026). Use npm
Trusted Publishers (GitHub Actions) rather than a long-lived token where
possible.

### Principle 10: Test-First for Transformation Logic

Any non-trivial data transformation (status-code mapping, address
normalization, unit conversion, payload assembly) MUST ship with unit tests
written before the implementation. This mirrors the carrier-mapping rigor
already proven on the FedEx node.

### Principle 11: AI-Agent Tool Compatibility (NON-NEGOTIABLE)

The node MUST work both as a normal node and as an n8n AI-Agent tool. Set
`usableAsTool: true` in the node description (per the declarative-style node
docs at docs.n8n.io/integrations/creating-nodes/build/declarative-style-node).
The normal path and the tool-execution path run different credential-resolution
code, so a node that passes as a normal node can still throw on the tool path.

Hard rule on credential cardinality: if the node carries two or more
credentials, they MUST be disambiguated by a node parameter literally named
`authentication`, matched against each credential's
`displayOptions.show.authentication`, never by gating on `operation`. Gating on
`operation` works for normal runs but throws `Could not get parameter:
authentication` under AI-Agent tool execution. The safe pattern is a hidden
`authentication` property declared once per credential with disjoint
`displayOptions.show.operation` defaults, which n8n's `Workflow` constructor
materializes on both paths. Every operation MUST be tested through the tool
path, not just as a normal node. (gotchas §1)

> Purolator-specific (RESOLVED): all v1 APIs share one OAuth credential
> (`portal_api` scope) plus one `X-Api-Key`, with no per-API entitlement split.
> The node is single-credential, so the multi-credential
> `authentication`-param mechanism is not required for v1. This principle's
> `usableAsTool` requirement and tool-path testing still apply. Re-evaluate if
> v1.1 introduces a separately-entitled API.

### Principle 12: Verify Against Live Behaviour, Not Docs Alone (NON-NEGOTIABLE)

Carrier API docs misstate auth and entitlement details often enough that they
cannot be trusted blind. Verify the OAuth token exchange and every endpoint
through a real call on the through-n8n path, not an isolated curl/script that
can mask scope and entitlement bugs. Two confirmed FedEx traps with direct
Purolator analogues:

- Scope is carrier-specific. FedEx rejects an explicit scope; Purolator
  requires exactly `scope=portal_api`. Confirm the live token exchange accepts
  the documented value before locking it in. (gotchas §2)
- Entitlements may be per-API. FedEx issued disjoint per-project keys, so a
  valid token returns 403 on the wrong endpoint, which reads like a phantom
  auth bug. Confirm whether one Purolator credential covers
  Estimate/Ship/Track/Pickup or whether they are separately entitled. This
  decides credential cardinality and feeds Principle 11. (gotchas §3)

## Inherited Engineering Guardrails (from n8n-nodes-fedex)

Operational traps carried over from the FedEx build; full detail in that
project's `docs/n8n-gotchas.md`. These constrain `/speckit.plan` and
`/speckit.tasks`. Build the package with the `n8n-node` CLI
(docs.n8n.io/integrations/creating-nodes/build/n8n-node) so structure and
metadata match verified-node requirements
(docs.n8n.io/integrations/creating-nodes/build/reference/verification-guidelines).

**Dev environment**

- Node.js MUST be >= 22.22 (22.16 is rejected). (gotchas §5)
- `@n8n/node-cli` has no `--strict` flag; strictness comes from
  `n8n.strict: true` in `package.json`, applied by `n8n-node lint`. (gotchas §5)
- Under `n8n-node dev`, the live node type is `CUSTOM.<nodeName>`, not
  `n8n-nodes-purolator.<nodeName>`; the published type only applies after npm
  install. Test workflows MUST reference the right one. (gotchas §4)

**Build**

- Keep TypeScript `incremental` OFF (no `tsBuildInfoFile`). An external
  build-info file survives `rimraf dist`, makes `tsc` skip re-emitting, and
  produces an incomplete `dist` that fails at load with a missing-module error.
  Always run `npm pack --dry-run` to confirm the tarball is LICENSE + README +
  dist only. (gotchas §7)

**Release** (reinforces Principle 9)

- Publish via `n8n-node release`, never raw `npm publish`; a `prepublishOnly`
  guard exits 1 otherwise. (gotchas §7)
- Use npm OIDC Trusted Publishing (GitHub Actions, `id-token: write`, npm >=
  11.5.1); no long-lived token. A `404 PUT` on a scoped package means the
  publish ran unauthenticated. First-publish read-CDN propagation can lag
  ~5 min. (gotchas §7)

**Verification**

- The Creator Portal ties a submission to a version but reviewers always pull
  the latest published npm version at review time, so keep the latest fix on
  npm rather than trying to swap the submitted version. (gotchas §8)
- The reliable test harness is a Docker n8n container with the package
  installed, run headlessly via `n8n execute --id <id>` on a separate broker
  port, not the unreliable headless chat webhook. (gotchas §9)

**n8n public REST API limits** (for the test harness)

- No node-types or execute endpoint on the public API; `PUT /workflows/{id}`
  needs the full body and a strict `settings` object (send
  `{"executionOrder":"v1"}` only). The credentials list never returns secret
  values. (gotchas §6)

## Governance

This constitution supersedes all other development practices for the
n8n-nodes-purolator package. Every `/speckit.specify`, `/speckit.plan`, and
`/speckit.tasks` artifact MUST be checked against these principles, and the
plan template's Constitution Check gate derives its gates directly from this
file. Principles marked NON-NEGOTIABLE (1, 2, 3, 11, 12) are hard gates: a plan
or task set that violates one MUST be revised, not waived. Any deviation from a
principle that is not marked NON-NEGOTIABLE MUST be documented with explicit
justification in the plan's Complexity/Tracking section.

Versioning follows semantic versioning:

- **MAJOR**: backward-incompatible governance or principle removals /
  redefinitions.
- **MINOR**: a new principle or section added, or materially expanded guidance.
- **PATCH**: clarifications, wording, typo fixes, non-semantic refinements.

Compliance is reviewed at every Spec Kit phase transition and before any npm
publish. Reviewers verify that the package passes
`@n8n/scan-community-package`, that no secrets are present in committed files,
and that every operation has been exercised on the live through-n8n path
(Principle 12) including the AI-Agent tool path (Principle 11).

## Amendment Process

Changes to this constitution require a version bump (semver), a dated entry
below, and re-running `/speckit.plan` to re-check downstream artifacts for
compliance.

| Version | Date       | Change |
|---------|------------|--------|
| 1.0.0   | 2026-06-15 | Initial ratification |
| 1.1.0   | 2026-06-15 | Added Principles 11 (AI-Agent tool compat) and 12 (verify live); folded n8n-nodes-fedex gotchas in as Inherited Engineering Guardrails; strengthened Principle 6 (secret rotation) |

**Version**: 1.1.0 | **Ratified**: 2026-06-15 | **Last Amended**: 2026-06-15
