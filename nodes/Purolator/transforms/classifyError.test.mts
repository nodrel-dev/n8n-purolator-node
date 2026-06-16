import { describe, it, expect } from 'vitest';
import { extractCarrierFault, redactSecrets } from './classifyError';

describe('extractCarrierFault', () => {
	it("reads Purolator's { errors: [{ code, description }] } shape", () => {
		expect(
			extractCarrierFault({ errors: [{ code: '9001-10', description: 'ProductID is required.' }] }),
		).toEqual({ code: '9001-10', message: 'ProductID is required.' });
	});

	it('tolerates a faults/message variant', () => {
		expect(extractCarrierFault({ faults: [{ code: 'E1', message: 'Bad lane' }] })).toEqual({
			code: 'E1',
			message: 'Bad lane',
		});
		expect(extractCarrierFault({ message: 'Unauthorized' })).toEqual({
			code: 'unknown',
			message: 'Unauthorized',
		});
	});

	it('handles a plain string body', () => {
		expect(extractCarrierFault('Service unavailable')).toEqual({
			code: 'unknown',
			message: 'Service unavailable',
		});
	});

	it('falls back to a generic message for an unrecognized body', () => {
		expect(extractCarrierFault({ weird: true }, 'fallback msg')).toEqual({
			code: 'unknown',
			message: 'fallback msg',
		});
	});
});

describe('redactSecrets', () => {
	it('replaces secret values wherever they appear', () => {
		const text = 'token=SECRETVALUE123 used for apiKey=APIKEY9876';
		expect(redactSecrets(text, ['SECRETVALUE123', 'APIKEY9876'])).toBe(
			'token=*** used for apiKey=***',
		);
	});

	it('ignores blank/short secrets to avoid over-redacting', () => {
		expect(redactSecrets('hello world', ['', undefined, 'ab'])).toBe('hello world');
	});
});
