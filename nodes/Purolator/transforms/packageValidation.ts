// Minimal, structural local validation only (FR-X-011). Carrier business rules pass through.
// Pure: no n8n imports. Tested first (Principle 10).

export class PurolatorValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PurolatorValidationError';
	}
}

export interface PieceInput {
	weight?: number;
	length?: number;
	width?: number;
	height?: number;
}

export interface PackageInput {
	totalWeight?: number;
	totalPackages?: number;
	pieces?: PieceInput[];
}

/** Sender must be Canadian — the one address rule worth catching locally (estimate.md). */
export function assertSenderCanada(country?: string): void {
	if ((country ?? '').trim().toUpperCase() !== 'CA') {
		throw new PurolatorValidationError(
			'Sender country must be CA — Purolator only accepts Canadian origins.',
		);
	}
}

/** Dimensions are all-three-or-none (estimate.md package dimension rule). */
export function assertDimensionsComplete(piece: PieceInput, index: number): void {
	const provided = [piece.length, piece.width, piece.height].filter(
		(value) => value !== undefined && value !== null,
	);
	if (provided.length !== 0 && provided.length !== 3) {
		throw new PurolatorValidationError(
			`Piece ${index + 1}: length, width, and height must be provided together or not at all.`,
		);
	}
}

/**
 * Validate the structural minimum needed to assemble a well-formed estimate request:
 * explicit total weight (> 0) and package count (>= 1), each added piece has a weight, and any
 * piece dimensions are all-three-or-none. Everything else (the 150 lb/68 kg cap, serviceability)
 * is the carrier's to enforce (FR-X-011).
 */
export function validatePackage(pkg: PackageInput): void {
	if (typeof pkg.totalWeight !== 'number' || pkg.totalWeight <= 0) {
		throw new PurolatorValidationError('Total Weight is required and must be greater than 0.');
	}
	if (typeof pkg.totalPackages !== 'number' || pkg.totalPackages < 1) {
		throw new PurolatorValidationError('Total Packages is required and must be at least 1.');
	}
	for (const [index, piece] of (pkg.pieces ?? []).entries()) {
		if (typeof piece.weight !== 'number' || piece.weight <= 0) {
			throw new PurolatorValidationError(
				`Piece ${index + 1}: weight is required and must be greater than 0.`,
			);
		}
		assertDimensionsComplete(piece, index);
	}
}
