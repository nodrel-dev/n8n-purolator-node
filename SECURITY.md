# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately via GitHub's [private vulnerability reporting](https://github.com/nodrel-dev/n8n-purolator-node/security/advisories/new),
or by email to **kytully@gmail.com**. Include a description, affected version, and reproduction
steps. You'll get an acknowledgement within a few days, and a fix or mitigation as quickly as is
practical.

## Supported versions

This is a pre-1.0 package; only the latest published `0.x` release on npm receives security fixes.
Always run the newest version.

## Credential safety (important)

This node talks to the Purolator REST API using **your own** Purolator `client_id`,
`client_secret`, and `X-Api-Key` (plus your account number), supplied through n8n's encrypted
credential store. To keep them safe:

- **Never paste client IDs/secrets, API keys, OAuth tokens, or account numbers** into GitHub
  issues, pull requests, discussions, logs, or screenshots. Redact them first.
- Keep credentials in n8n's credential manager (or a local `.env.local` for development) — never
  hardcode them in workflows, code, or committed files.
- The credential defaults to the **sandbox** environment so a half-configured connection cannot
  hit a live account. Switch to production only when you intend to.
- The node never places secrets in logs, error messages, or URLs.
- If you believe a secret has been exposed, **rotate it in the Purolator portal immediately** —
  redacting a commit is not enough, since git retains orphaned commits by SHA until garbage
  collection.

## Supply-chain integrity

Releases are published to npm from GitHub Actions with **npm provenance** (SLSA attestation) over
OIDC Trusted Publishing — no long-lived tokens. You can verify a published version's provenance on
its npm page.
