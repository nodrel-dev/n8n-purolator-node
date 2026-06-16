// Canonical node-facing Address → each Purolator API's native field names (ADR-0005).
// Pure: no n8n imports. Tested first (Principle 10).

const MAX_STREET_LINES = 3;

/** The single node-facing address shape reused across operations. */
export interface Address {
	street?: string;
	city?: string;
	province?: string;
	country?: string;
	postalCode?: string;
	companyName?: string;
}

/** Estimate API native shape (`SenderAddress` / `ReceiverAddress`). */
export interface EstimateAddress {
	companyName?: string;
	streetAddress?: string[];
	city?: string;
	provinceStateCode?: string;
	country?: string;
	postalZipCode?: string;
}

/** Pickup API native shape (`pickupAddress`). */
export interface PickupAddress {
	companyName?: string;
	streetAddress?: string[];
	city?: string;
	province?: string;
	country?: string;
	postalCode?: string;
}

/** Locator API native shape (query params). */
export interface LocatorAddress {
	streetAddress?: string;
	city?: string;
	provinceCode?: string;
	postalCode?: string;
}

/** Split a multi-line street string into trimmed, non-empty lines, capped at three. */
export function toStreetLines(street?: string): string[] {
	return (street ?? '')
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.slice(0, MAX_STREET_LINES);
}

function clean(value?: string): string {
	return (value ?? '').trim();
}

export function toEstimateAddress(address: Address): EstimateAddress {
	const lines = toStreetLines(address.street);
	const province = clean(address.province);
	const company = clean(address.companyName);
	return {
		...(company ? { companyName: company } : {}),
		...(lines.length ? { streetAddress: lines } : {}),
		city: clean(address.city),
		...(province ? { provinceStateCode: province } : {}),
		country: clean(address.country),
		postalZipCode: clean(address.postalCode),
	};
}

export function toPickupAddress(address: Address): PickupAddress {
	const lines = toStreetLines(address.street);
	const province = clean(address.province);
	const company = clean(address.companyName);
	return {
		...(company ? { companyName: company } : {}),
		...(lines.length ? { streetAddress: lines } : {}),
		city: clean(address.city),
		...(province ? { province } : {}),
		country: clean(address.country) || 'CA',
		postalCode: clean(address.postalCode),
	};
}

export function toLocatorAddress(address: Address): LocatorAddress {
	const lines = toStreetLines(address.street);
	const province = clean(address.province);
	return {
		...(lines.length ? { streetAddress: lines.join(' ') } : {}),
		...(clean(address.city) ? { city: clean(address.city) } : {}),
		...(province ? { provinceCode: province } : {}),
		...(clean(address.postalCode) ? { postalCode: clean(address.postalCode) } : {}),
	};
}
