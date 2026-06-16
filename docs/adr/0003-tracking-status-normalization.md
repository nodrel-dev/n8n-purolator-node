# Tracking status: normalize + always passthrough raw, additive-only

Purolator's Tracking OAS defines `status`, `statusCode`, `subCode`, and `reasonCode` but publishes **no enum** of their values — live responses contain codes we have not seen. FR-X-005 still requires a documented, stable normalized status set. We reconcile these by emitting **both** the raw carrier `statusCode`/`subCode`/description **and** a `normalizedStatus` drawn from our own carrier-agnostic set: `Created`, `InTransit`, `OutForDelivery`, `AttemptedDelivery`, `Delivered`, `HeldForPickup`, `Exception`, `ReturnToSender`, `Cancelled`, `Unknown`.

Two rules make this safe against the open code set: any unmapped code resolves to `Unknown` (never an error, and the raw code is always present for debugging), and the normalized set is **additive-only** — values are added as new codes are observed, never renamed or removed — so downstream workflows that branch on `normalizedStatus` never break. The carrier-code → normalized mapping is a pure function, unit-tested first per Constitution Principle 10.

Considered and rejected: raw passthrough only (fails FR-X-005) and strict normalization that drops the raw code (brittle — any unseen code is lost or misclassified, and output becomes undebuggable). Pickup keeps its separate, carrier-fixed status set.
