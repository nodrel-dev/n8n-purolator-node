// Mirror-the-carrier error classification (ADR-0004, FR-X-010) + secret redaction (FR-X-004).
// Pure: no n8n imports. Tested first (Principle 10).

export interface CarrierFault {
	code: string;
	message: string;
}

type Unknown = Record<string, unknown>;

function asRecord(value: unknown): Unknown | undefined {
	return value && typeof value === 'object' ? (value as Unknown) : undefined;
}

function firstFault(list: unknown): CarrierFault | undefined {
	if (!Array.isArray(list) || list.length === 0) {
		return undefined;
	}
	const entry = asRecord(list[0]);
	if (!entry) {
		return undefined;
	}
	const code = entry.code ?? entry.Code ?? entry.errorCode;
	const message = entry.description ?? entry.message ?? entry.Message ?? entry.detail;
	if (code === undefined && message === undefined) {
		return undefined;
	}
	return {
		code: code === undefined ? 'unknown' : String(code),
		message: message === undefined ? 'Unknown carrier error' : String(message),
	};
}

/**
 * Pull a carrier fault `{ code, message }` out of a Purolator error response body. Purolator
 * returns `{ errors: [{ code, description }] }`; we also tolerate a few other common shapes and
 * a plain string body. Falls back to a generic message so a malformed body never crashes us.
 */
export function extractCarrierFault(
	body: unknown,
	fallbackMessage = 'Purolator request failed',
): CarrierFault {
	if (typeof body === 'string' && body.trim()) {
		return { code: 'unknown', message: body.trim() };
	}
	const record = asRecord(body);
	if (record) {
		const fault =
			firstFault(record.errors) ??
			firstFault(record.Errors) ??
			firstFault(record.faults) ??
			firstFault(record.Faults);
		if (fault) {
			return fault;
		}
		const message = record.message ?? record.Message ?? record.error;
		if (typeof message === 'string' && message.trim()) {
			return { code: 'unknown', message: message.trim() };
		}
	}
	return { code: 'unknown', message: fallbackMessage };
}

/**
 * Replace any occurrence of a secret value with a redaction marker, so credentials never leak
 * into an error message, log, or output item (FR-X-004). Short/blank values are ignored to avoid
 * over-redacting incidental text.
 */
export function redactSecrets(text: string, secrets: Array<string | undefined>): string {
	let result = text;
	for (const secret of secrets) {
		const value = (secret ?? '').trim();
		if (value.length < 4) {
			continue;
		}
		result = result.split(value).join('***');
	}
	return result;
}
