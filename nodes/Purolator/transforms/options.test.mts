import { describe, it, expect } from 'vitest';
import { buildOptionPairs } from './options';

describe('buildOptionPairs', () => {
	it('emits a true pair only for enabled curated booleans', () => {
		expect(buildOptionPairs({ adultSignatureRequired: true, holdForPickup: false })).toEqual([
			{ optionId: 'AdultSignatureRequired', optionIdValue: 'true' },
		]);
	});

	it('emits declared value and dangerous-goods class/mode as string values', () => {
		expect(
			buildOptionPairs({
				declaredValue: 250,
				dangerousGoods: true,
				dangerousGoodsClass: 'UN3373',
				dangerousGoodsMode: 'Ground',
			}),
		).toEqual([
			{ optionId: 'DeclaredValue', optionIdValue: '250' },
			{ optionId: 'DangerousGoods', optionIdValue: 'true' },
			{ optionId: 'DangerousGoodsClass', optionIdValue: 'UN3373' },
			{ optionId: 'DangerousGoodsMode', optionIdValue: 'Ground' },
		]);
	});

	it('appends generic additional options and defaults a missing value to true', () => {
		expect(
			buildOptionPairs({}, [{ optionId: 'SaturdayDelivery' }, { optionId: 'ExpressCheque', optionIdValue: 'false' }]),
		).toEqual([
			{ optionId: 'SaturdayDelivery', optionIdValue: 'true' },
			{ optionId: 'ExpressCheque', optionIdValue: 'false' },
		]);
	});

	it('lets a later additional option override an earlier curated pair with the same id', () => {
		expect(
			buildOptionPairs({ holdForPickup: true }, [{ optionId: 'HoldForPickup', optionIdValue: 'false' }]),
		).toEqual([{ optionId: 'HoldForPickup', optionIdValue: 'false' }]);
	});

	it('ignores additional options with a blank id and returns [] for no options', () => {
		expect(buildOptionPairs({}, [{ optionId: '   ' }])).toEqual([]);
		expect(buildOptionPairs()).toEqual([]);
	});
});
