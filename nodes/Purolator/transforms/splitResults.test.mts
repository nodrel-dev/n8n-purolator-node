import { describe, it, expect } from 'vitest';
import { splitResults } from './splitResults';

const services = [{ serviceId: 'A' }, { serviceId: 'B' }];

describe('splitResults', () => {
	it('returns one item per element when split is on (default behaviour)', () => {
		expect(splitResults(services, true, 'services')).toEqual([
			{ serviceId: 'A' },
			{ serviceId: 'B' },
		]);
	});

	it('nests results under the key when split is off', () => {
		expect(splitResults(services, false, 'services')).toEqual([{ services: services }]);
	});

	it('preserves an empty result set as an empty array, never an error', () => {
		expect(splitResults([], true, 'services')).toEqual([]);
		expect(splitResults([], false, 'services')).toEqual([{ services: [] }]);
	});
});
