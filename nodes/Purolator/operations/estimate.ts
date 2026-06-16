import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { resolveAccountNumber } from '../transforms/accountNumber';
import { toEstimateAddress, type Address } from '../transforms/address';
import { extractEstimateServices } from '../transforms/estimateResponse';
import { buildOptionPairs, type AdditionalOption, type CuratedOptions } from '../transforms/options';
import { assertSenderCanada, validatePackage } from '../transforms/packageValidation';
import { splitResults } from '../transforms/splitResults';
import { getBaseUrl, purolatorRequest } from '../transport/request';

function readAddress(this: IExecuteFunctions, name: string, itemIndex: number): Address {
	const raw = this.getNodeParameter(`${name}.value`, itemIndex, {}) as IDataObject;
	return {
		street: (raw.street as string) ?? '',
		city: (raw.city as string) ?? '',
		province: (raw.province as string) ?? '',
		country: (raw.country as string) ?? '',
		postalCode: (raw.postalCode as string) ?? '',
		companyName: (raw.companyName as string) ?? '',
	};
}

/**
 * Estimate operation (POST /rate/v1/shipment). Assembles the Courier estimate body from the
 * canonical Address + hybrid options, validates only the structural minimum (sender CA, package
 * shape — FR-X-011), then shapes eligible services via the Split Results toggle (FR-X-009).
 */
export async function executeEstimate(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject[]> {
	const credentials = await this.getCredentials('purolatorApi');

	const sender = readAddress.call(this, 'sender', itemIndex);
	const receiver = readAddress.call(this, 'receiver', itemIndex);
	assertSenderCanada(sender.country);

	const totalWeight = this.getNodeParameter('totalWeight', itemIndex) as number;
	const totalPackages = this.getNodeParameter('totalPackages', itemIndex) as number;
	const piecesRaw = this.getNodeParameter('pieces.piece', itemIndex, []) as IDataObject[];
	const pieces = piecesRaw.map((piece) => ({
		weight: piece.weight as number,
		length: (piece.length as number) || undefined,
		width: (piece.width as number) || undefined,
		height: (piece.height as number) || undefined,
	}));
	validatePackage({ totalWeight, totalPackages, pieces });

	const accountNumber = resolveAccountNumber(
		this.getNodeParameter('accountNumber', itemIndex, '') as string,
		credentials.defaultAccountNumber as string,
	);

	const curated = this.getNodeParameter('options', itemIndex, {}) as CuratedOptions;
	const additional = (
		this.getNodeParameter('additionalOptions.option', itemIndex, []) as AdditionalOption[]
	).map((option) => ({ optionId: option.optionId, optionIdValue: option.optionIdValue }));
	const optionPairs = buildOptionPairs(curated, additional);

	const unitOfMeasurement = this.getNodeParameter('unitOfMeasurement', itemIndex) as string;
	const serviceId = this.getNodeParameter('primaryService', itemIndex) as string;
	const showAlternativeServicesIndicator = this.getNodeParameter(
		'showAlternativeServices',
		itemIndex,
	) as boolean;
	const displayPublishedRates = this.getNodeParameter('displayPublishedRates', itemIndex) as boolean;
	const shipmentDate = (this.getNodeParameter('shipmentDate', itemIndex, '') as string).trim();

	const shipmentInformation: IDataObject = {
		serviceId,
		unitOfMeasurement,
		showAlternativeServicesIndicator,
		totalWeight,
		totalPackages,
		...(optionPairs.length ? { shipmentOptionsInformation: optionPairs } : {}),
		...(pieces.length
			? {
					packageInformation: pieces.map((piece) => ({
						packageWeight: piece.weight,
						...(piece.length !== undefined ? { packageLength: piece.length } : {}),
						...(piece.width !== undefined ? { packageWidth: piece.width } : {}),
						...(piece.height !== undefined ? { packageHeight: piece.height } : {}),
					})),
				}
			: {}),
	};

	const body: IDataObject = {
		lineOfBusiness: 'Courier',
		...(shipmentDate ? { shipmentDate } : {}),
		outboundShipment: {
			billingInformation: { billingAccountNumber: accountNumber, displayPublishedRates },
			senderInformation: toEstimateAddress(sender),
			receiverInformation: toEstimateAddress(receiver),
			shipmentInformation,
		},
	};

	const language = this.getNodeParameter('language', itemIndex, 'en') as string;
	const requestReference = (this.getNodeParameter('requestReference', itemIndex, '') as string).trim();
	const headers: Record<string, string> = { Language: language === 'fr' ? 'FR' : 'EN' };
	if (requestReference) {
		headers.RequestReference = requestReference;
	}

	const baseUrl = getBaseUrl(credentials.environment);
	const response = await purolatorRequest.call(this, baseUrl, {
		method: 'POST',
		path: '/rate/v1/shipment',
		body,
		headers,
	});

	const services = extractEstimateServices(response);
	const split = this.getNodeParameter('splitResults', itemIndex, true) as boolean;
	return splitResults(services, split, 'services') as unknown as IDataObject[];
}
