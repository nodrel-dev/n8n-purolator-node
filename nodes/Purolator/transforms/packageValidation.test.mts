import { describe, it, expect } from 'vitest';
import {
	assertDimensionsComplete,
	assertSenderCanada,
	PurolatorValidationError,
	validatePackage,
} from './packageValidation';

describe('assertSenderCanada', () => {
	it('accepts CA (case-insensitive, trimmed)', () => {
		expect(() => assertSenderCanada(' ca ')).not.toThrow();
	});

	it('rejects non-CA origins', () => {
		expect(() => assertSenderCanada('US')).toThrow(PurolatorValidationError);
		expect(() => assertSenderCanada('')).toThrow(/Sender country must be CA/);
	});
});

describe('assertDimensionsComplete', () => {
	it('allows none of L/W/H', () => {
		expect(() => assertDimensionsComplete({ weight: 1 }, 0)).not.toThrow();
	});

	it('allows all three', () => {
		expect(() => assertDimensionsComplete({ length: 1, width: 2, height: 3 }, 0)).not.toThrow();
	});

	it('rejects a partial dimension set', () => {
		expect(() => assertDimensionsComplete({ length: 1, width: 2 }, 1)).toThrow(
			/Piece 2: length, width, and height/,
		);
	});
});

describe('validatePackage', () => {
	it('passes a valid shipment-level package', () => {
		expect(() => validatePackage({ totalWeight: 10, totalPackages: 2 })).not.toThrow();
	});

	it('requires positive total weight and at least one package', () => {
		expect(() => validatePackage({ totalWeight: 0, totalPackages: 1 })).toThrow(/Total Weight/);
		expect(() => validatePackage({ totalWeight: 5, totalPackages: 0 })).toThrow(/Total Packages/);
	});

	it('requires a weight on each added piece and validates its dimensions', () => {
		expect(() => validatePackage({ totalWeight: 5, totalPackages: 1, pieces: [{}] })).toThrow(
			/Piece 1: weight is required/,
		);
		expect(() =>
			validatePackage({ totalWeight: 5, totalPackages: 1, pieces: [{ weight: 5, length: 1 }] }),
		).toThrow(/length, width, and height/);
	});
});
