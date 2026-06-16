import { describe, it, expect, vi } from 'vitest';
import {
	computeBackoffMs,
	extractRetryAfterMs,
	extractStatusCode,
	isRetryable,
	withRetry,
} from './retry';

describe('extractStatusCode', () => {
	it('reads common error shapes', () => {
		expect(extractStatusCode({ statusCode: 503 })).toBe(503);
		expect(extractStatusCode({ httpCode: '429' })).toBe(429);
		expect(extractStatusCode({ response: { statusCode: 500 } })).toBe(500);
		expect(extractStatusCode({ cause: { response: { statusCode: 502 } } })).toBe(502);
	});

	it('returns undefined when no status is present', () => {
		expect(extractStatusCode(new Error('boom'))).toBeUndefined();
	});
});

describe('extractRetryAfterMs', () => {
	it('converts a Retry-After header (seconds) to ms', () => {
		expect(extractRetryAfterMs({ response: { headers: { 'retry-after': '2' } } })).toBe(2000);
		expect(extractRetryAfterMs({ response: { headers: { 'Retry-After': 5 } } })).toBe(5000);
	});

	it('returns undefined when absent', () => {
		expect(extractRetryAfterMs({ response: { headers: {} } })).toBeUndefined();
	});
});

describe('isRetryable', () => {
	it('retries 429 and 5xx only', () => {
		expect(isRetryable(429)).toBe(true);
		expect(isRetryable(500)).toBe(true);
		expect(isRetryable(503)).toBe(true);
		expect(isRetryable(400)).toBe(false);
		expect(isRetryable(404)).toBe(false);
		expect(isRetryable(undefined)).toBe(false);
	});
});

describe('computeBackoffMs', () => {
	it('grows exponentially and applies jitter within 50–100% of the exponential', () => {
		expect(computeBackoffMs(1, 1000, 0)).toBe(500);
		expect(computeBackoffMs(1, 1000, 1)).toBe(1000);
		expect(computeBackoffMs(2, 1000, 1)).toBe(2000);
		expect(computeBackoffMs(3, 1000, 0)).toBe(2000);
	});
});

const noopSleep = async () => {};

describe('withRetry', () => {
	it('returns immediately on success', async () => {
		const fn = vi.fn().mockResolvedValue('ok');
		await expect(withRetry(fn, { sleep: noopSleep })).resolves.toBe('ok');
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('retries transient errors then succeeds', async () => {
		const fn = vi
			.fn()
			.mockRejectedValueOnce({ statusCode: 503 })
			.mockResolvedValue('recovered');
		await expect(withRetry(fn, { sleep: noopSleep, jitter: () => 0 })).resolves.toBe('recovered');
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('does not retry 4xx', async () => {
		const fn = vi.fn().mockRejectedValue({ statusCode: 400 });
		await expect(withRetry(fn, { sleep: noopSleep })).rejects.toMatchObject({ statusCode: 400 });
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('gives up after maxAttempts and re-throws the last error', async () => {
		const fn = vi.fn().mockRejectedValue({ statusCode: 500 });
		await expect(
			withRetry(fn, { sleep: noopSleep, jitter: () => 0, maxAttempts: 3 }),
		).rejects.toMatchObject({ statusCode: 500 });
		expect(fn).toHaveBeenCalledTimes(3);
	});

	it('honors a Retry-After header for the delay', async () => {
		const sleep = vi.fn(async () => {});
		const fn = vi
			.fn()
			.mockRejectedValueOnce({ statusCode: 429, response: { headers: { 'retry-after': '3' } } })
			.mockResolvedValue('ok');
		await withRetry(fn, { sleep });
		expect(sleep).toHaveBeenCalledWith(3000);
	});
});
