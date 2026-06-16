// Bounded, jittered retry with Retry-After support (FR-X-003). Injectable for tests.
import { sleep } from 'n8n-workflow';

export interface RetryConfig {
	maxAttempts: number;
	baseDelayMs: number;
	sleep: (ms: number) => Promise<void>;
	jitter: () => number;
}

const DEFAULTS: RetryConfig = {
	maxAttempts: 3,
	baseDelayMs: 1000,
	sleep,
	jitter: Math.random,
};

/** Safely read a nested value from an unknown error object without using `any`. */
function dig(value: unknown, ...path: string[]): unknown {
	let current = value;
	for (const key of path) {
		if (current && typeof current === 'object') {
			current = (current as Record<string, unknown>)[key];
		} else {
			return undefined;
		}
	}
	return current;
}

function toNumber(candidate: unknown): number | undefined {
	const value = typeof candidate === 'string' ? Number.parseInt(candidate, 10) : candidate;
	return typeof value === 'number' && !Number.isNaN(value) ? value : undefined;
}

/** Pull an HTTP status code out of the various error shapes n8n / undici can throw. */
export function extractStatusCode(error: unknown): number | undefined {
	const candidates = [
		dig(error, 'statusCode'),
		dig(error, 'httpCode'),
		dig(error, 'response', 'statusCode'),
		dig(error, 'response', 'status'),
		dig(error, 'cause', 'statusCode'),
		dig(error, 'cause', 'response', 'statusCode'),
	];
	for (const candidate of candidates) {
		const value = toNumber(candidate);
		if (value !== undefined) {
			return value;
		}
	}
	return undefined;
}

/** Read a `Retry-After` header (in seconds) from the error, returning milliseconds. */
export function extractRetryAfterMs(error: unknown): number | undefined {
	const headers = dig(error, 'response', 'headers') ?? dig(error, 'cause', 'response', 'headers');
	const raw = dig(headers, 'retry-after') ?? dig(headers, 'Retry-After');
	if (raw === undefined || raw === null) {
		return undefined;
	}
	const seconds = toNumber(raw);
	return seconds !== undefined && seconds >= 0 ? seconds * 1000 : undefined;
}

/** Transient = throttle (429) or any 5xx. 4xx validation errors are never retried. */
export function isRetryable(status: number | undefined): boolean {
	if (status === undefined) {
		return false;
	}
	return status === 429 || (status >= 500 && status <= 599);
}

/** Exponential backoff (base * 2^(attempt-1)) with 50–100% jitter applied. */
export function computeBackoffMs(attempt: number, baseDelayMs: number, jitter: number): number {
	const exponential = baseDelayMs * 2 ** (attempt - 1);
	const factor = 0.5 + 0.5 * Math.min(Math.max(jitter, 0), 1);
	return Math.round(exponential * factor);
}

/**
 * Run `fn`, retrying on transient (5xx/429) failures up to `maxAttempts` total, honoring a
 * `Retry-After` header when present and otherwise using jittered exponential backoff. 4xx and
 * non-HTTP errors propagate immediately. The final attempt's error is re-thrown.
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	config: Partial<RetryConfig> = {},
): Promise<T> {
	const cfg = { ...DEFAULTS, ...config };
	let lastError: unknown;
	for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			const status = extractStatusCode(error);
			if (!isRetryable(status) || attempt === cfg.maxAttempts) {
				// Propagate the original carrier/HTTP error; the node layer wraps it for n8n.
				// eslint-disable-next-line @n8n/community-nodes/require-node-api-error
				throw error;
			}
			const delay =
				extractRetryAfterMs(error) ?? computeBackoffMs(attempt, cfg.baseDelayMs, cfg.jitter());
			await cfg.sleep(delay);
		}
	}
	// Unreachable in practice (the loop throws on its final attempt); satisfies control flow.

	throw lastError;
}
