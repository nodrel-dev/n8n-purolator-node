// Extract the eligible-services array from a Courier estimate response. Pure, tested.
// Response shape: { outboundShipmentEstimates: { shipmentEstimate: [ ... ] } } (estimate.json).

export type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | undefined {
	return value && typeof value === 'object' ? (value as JsonRecord) : undefined;
}

/**
 * Return the list of eligible service estimates. An empty/absent list yields `[]` (a carrier 200
 * with no services is a normal empty result, never an error — ADR-0004).
 */
export function extractEstimateServices(response: unknown): JsonRecord[] {
	const root = asRecord(response);
	const outbound = asRecord(root?.outboundShipmentEstimates);
	const list = outbound?.shipmentEstimate;
	if (!Array.isArray(list)) {
		return [];
	}
	return list.filter((entry): entry is JsonRecord => asRecord(entry) !== undefined);
}
