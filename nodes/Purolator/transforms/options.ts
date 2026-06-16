// Curated + generic shipment options → Purolator's optionId/optionIdValue pair list (FR-001, R7).
// Pure: no n8n imports. Tested first (Principle 10).

export interface CuratedOptions {
	adultSignatureRequired?: boolean;
	holdForPickup?: boolean;
	residentialSignatureDomestic?: boolean;
	declaredValue?: number;
	dangerousGoods?: boolean;
	dangerousGoodsClass?: string;
	dangerousGoodsMode?: string;
}

export interface AdditionalOption {
	optionId?: string;
	optionIdValue?: string;
}

export interface OptionPair {
	optionId: string;
	optionIdValue: string;
}

/**
 * Assemble the carrier's `shipmentOptionsInformation` pair list from the node's hybrid options:
 * high-frequency curated toggles/values plus a generic collection for the long tail and future
 * option IDs. Curated booleans only emit a pair when true; declared value and dangerous-goods
 * class/mode emit their string value. Later additional options override an earlier curated pair
 * with the same optionId.
 */
export function buildOptionPairs(
	curated: CuratedOptions = {},
	additional: AdditionalOption[] = [],
): OptionPair[] {
	const pairs = new Map<string, string>();

	if (curated.adultSignatureRequired) {
		pairs.set('AdultSignatureRequired', 'true');
	}
	if (curated.holdForPickup) {
		pairs.set('HoldForPickup', 'true');
	}
	if (curated.residentialSignatureDomestic) {
		pairs.set('ResidentialSignatureDomestic', 'true');
	}
	if (typeof curated.declaredValue === 'number' && curated.declaredValue > 0) {
		pairs.set('DeclaredValue', String(curated.declaredValue));
	}
	if (curated.dangerousGoods) {
		pairs.set('DangerousGoods', 'true');
	}
	if ((curated.dangerousGoodsClass ?? '').trim()) {
		pairs.set('DangerousGoodsClass', curated.dangerousGoodsClass!.trim());
	}
	if ((curated.dangerousGoodsMode ?? '').trim()) {
		pairs.set('DangerousGoodsMode', curated.dangerousGoodsMode!.trim());
	}

	for (const option of additional) {
		const id = (option.optionId ?? '').trim();
		if (!id) {
			continue;
		}
		const value = (option.optionIdValue ?? '').trim() || 'true';
		pairs.set(id, value);
	}

	return [...pairs.entries()].map(([optionId, optionIdValue]) => ({ optionId, optionIdValue }));
}
