import { describe, it, expect } from 'vitest';
import { extractEstimateServices } from './estimateResponse';

describe('extractEstimateServices', () => {
	it('returns the shipmentEstimate array from a courier response', () => {
		const response = {
			outboundShipmentEstimates: {
				shipmentEstimate: [
					{ serviceId: 'PurolatorGround', totalPrice: 12.5 },
					{ serviceId: 'PurolatorExpress', totalPrice: 25.0 },
				],
			},
		};
		expect(extractEstimateServices(response)).toEqual([
			{ serviceId: 'PurolatorGround', totalPrice: 12.5 },
			{ serviceId: 'PurolatorExpress', totalPrice: 25.0 },
		]);
	});

	it('returns an empty array for an absent or empty service list', () => {
		expect(extractEstimateServices({})).toEqual([]);
		expect(extractEstimateServices({ outboundShipmentEstimates: {} })).toEqual([]);
		expect(extractEstimateServices(undefined)).toEqual([]);
	});
});
