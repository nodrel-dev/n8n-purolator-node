import { describe, it, expect } from 'vitest';
import {
	toEstimateAddress,
	toLocatorAddress,
	toPickupAddress,
	toStreetLines,
	type Address,
} from './address';

const full: Address = {
	street: '  123 Main St \n\nUnit 4\nLine Three\nLine Four ',
	city: ' Mississauga ',
	province: 'ON',
	country: 'CA',
	postalCode: ' L4W5M8 ',
	companyName: ' Acme Co ',
};

describe('toStreetLines', () => {
	it('trims, drops blanks, and caps at three lines', () => {
		expect(toStreetLines(full.street)).toEqual(['123 Main St', 'Unit 4', 'Line Three']);
	});

	it('returns an empty array for missing/blank input', () => {
		expect(toStreetLines(undefined)).toEqual([]);
		expect(toStreetLines('   \n  ')).toEqual([]);
	});
});

describe('toEstimateAddress', () => {
	it('maps canonical fields to the Estimate native names', () => {
		expect(toEstimateAddress(full)).toEqual({
			companyName: 'Acme Co',
			streetAddress: ['123 Main St', 'Unit 4', 'Line Three'],
			city: 'Mississauga',
			provinceStateCode: 'ON',
			country: 'CA',
			postalZipCode: 'L4W5M8',
		});
	});

	it('omits province, company, and street when absent (intl receiver case)', () => {
		const intl = toEstimateAddress({ city: 'Paris', country: 'FR', postalCode: '75001' });
		expect('provinceStateCode' in intl).toBe(false);
		expect('companyName' in intl).toBe(false);
		expect('streetAddress' in intl).toBe(false);
		expect(intl).toEqual({ city: 'Paris', country: 'FR', postalZipCode: '75001' });
	});
});

describe('toPickupAddress', () => {
	it('maps to pickup native names and defaults country to CA', () => {
		expect(toPickupAddress({ ...full, country: '' })).toEqual({
			companyName: 'Acme Co',
			streetAddress: ['123 Main St', 'Unit 4', 'Line Three'],
			city: 'Mississauga',
			province: 'ON',
			country: 'CA',
			postalCode: 'L4W5M8',
		});
	});
});

describe('toLocatorAddress', () => {
	it('joins street lines and maps to locator query field names', () => {
		expect(toLocatorAddress(full)).toEqual({
			streetAddress: '123 Main St Unit 4 Line Three',
			city: 'Mississauga',
			provinceCode: 'ON',
			postalCode: 'L4W5M8',
		});
	});

	it('supports the common postal-code-only search', () => {
		expect(toLocatorAddress({ postalCode: 'L4W5M8' })).toEqual({ postalCode: 'L4W5M8' });
	});
});
