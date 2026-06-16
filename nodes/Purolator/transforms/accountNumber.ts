// Account-number resolution: per-operation override → credential default → fail (FR-X-012).
// Pure: no n8n imports. Tested first (Principle 10).

export class AccountNumberRequiredError extends Error {
	constructor() {
		super(
			'Account number required: set it on this operation, or set a default account number on the Purolator credential.',
		);
		this.name = 'AccountNumberRequiredError';
	}
}

/**
 * Resolve the account number an operation must send. The override (a per-operation parameter)
 * wins; otherwise the credential's optional default is used. If neither is present the request
 * would be incomplete, so we fail locally with a clear message rather than letting the carrier
 * return a confusing error (FR-X-011).
 */
export function resolveAccountNumber(override?: string, credentialDefault?: string): string {
	const resolved = (override ?? '').trim() || (credentialDefault ?? '').trim();
	if (!resolved) {
		throw new AccountNumberRequiredError();
	}
	return resolved;
}
