import { describe, it, expect } from 'vitest';
import { AccountNumberRequiredError, resolveAccountNumber } from './accountNumber';

describe('resolveAccountNumber', () => {
	it('prefers the per-operation override', () => {
		expect(resolveAccountNumber('111', '222')).toBe('111');
	});

	it('falls back to the credential default when no override', () => {
		expect(resolveAccountNumber('', '222')).toBe('222');
		expect(resolveAccountNumber(undefined, '222')).toBe('222');
	});

	it('trims surrounding whitespace', () => {
		expect(resolveAccountNumber('  333  ')).toBe('333');
	});

	it('throws a clear error when neither is set', () => {
		expect(() => resolveAccountNumber()).toThrow(AccountNumberRequiredError);
		expect(() => resolveAccountNumber('  ', '  ')).toThrow(/Account number required/);
	});
});
