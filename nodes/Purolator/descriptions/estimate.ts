import type { INodeProperties } from 'n8n-workflow';

const showForEstimate = { resource: ['estimate'] };

function addressCollection(
	name: string,
	displayName: string,
	hint: string,
): INodeProperties {
	return {
		displayName,
		name,
		type: 'fixedCollection',
		default: {},
		placeholder: 'Add Address',
		description: hint,
		displayOptions: { show: showForEstimate },
		options: [
			{
				name: 'value',
				displayName: 'Address',
				values: [
					{ displayName: 'Street', name: 'street', type: 'string', default: '', description: 'Street address (one line per row, max 3 lines)' },
					{ displayName: 'City', name: 'city', type: 'string', default: '' },
					{ displayName: 'Province / State Code', name: 'province', type: 'string', default: '', description: 'Province or state code, e.g. ON. Required for CA/US; omit for international receivers.' },
					{ displayName: 'Country', name: 'country', type: 'string', default: '', description: 'ISO 2-letter country code. Sender must be CA.' },
					{ displayName: 'Postal / ZIP Code', name: 'postalCode', type: 'string', default: '' },
					{ displayName: 'Company Name', name: 'companyName', type: 'string', default: '' },
				],
			},
		],
	};
}

export const estimateDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showForEstimate },
		options: [
			{
				name: 'Estimate',
				value: 'estimate',
				action: 'Estimate a shipment',
				description: 'Price a shipment and return eligible services with prices and transit times',
			},
		],
		default: 'estimate',
	},

	addressCollection('sender', 'Sender', 'The Canadian origin address (country must be CA)'),
	addressCollection('receiver', 'Receiver', 'The destination address (CA, US, or international)'),

	{
		displayName: 'Total Weight',
		name: 'totalWeight',
		type: 'number',
		default: 0,
		required: true,
		typeOptions: { minValue: 0 },
		displayOptions: { show: showForEstimate },
		description: 'Total billable weight of the shipment, in the selected unit of measurement',
	},
	{
		displayName: 'Total Packages',
		name: 'totalPackages',
		type: 'number',
		default: 1,
		required: true,
		typeOptions: { minValue: 1 },
		displayOptions: { show: showForEstimate },
		description: 'Total number of pieces in the shipment',
	},
	{
		displayName: 'Unit of Measurement',
		name: 'unitOfMeasurement',
		type: 'options',
		options: [
			{ name: 'Imperial (Lb / In)', value: 'Imperial' },
			{ name: 'Metric (Kg / Cm)', value: 'Metric' },
		],
		default: 'Imperial',
		displayOptions: { show: showForEstimate },
	},
	{
		displayName: 'Primary Service',
		name: 'primaryService',
		type: 'string',
		default: 'PurolatorGround',
		displayOptions: { show: showForEstimate },
		description:
			'The requested service ID that anchors the call (case-insensitive). Common values: PurolatorGround, PurolatorExpress, PurolatorExpress9AM, PurolatorExpress10:30AM. With Show Alternative Services on, all eligible services are still returned.',
	},
	{
		displayName: 'Show Alternative Services',
		name: 'showAlternativeServices',
		type: 'boolean',
		default: true,
		displayOptions: { show: showForEstimate },
		description: 'Whether to return all eligible services, not just the primary service',
	},
	{
		displayName: 'Display Published Rates',
		name: 'displayPublishedRates',
		type: 'boolean',
		default: false,
		displayOptions: { show: showForEstimate },
		description: 'Whether to return non-discounted published rates instead of account rates',
	},
	{
		displayName: 'Shipment Date',
		name: 'shipmentDate',
		type: 'string',
		default: '',
		placeholder: 'YYYY-MM-DD',
		displayOptions: { show: showForEstimate },
		description: 'Date of shipment (up to 10 days ahead). Defaults to today when left blank.',
	},
	{
		displayName: 'Account Number',
		name: 'accountNumber',
		type: 'string',
		default: '',
		displayOptions: { show: showForEstimate },
		description: 'Billing account number. Falls back to the credential default account number when blank.',
	},

	{
		displayName: 'Pieces',
		name: 'pieces',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		default: {},
		placeholder: 'Add Piece',
		displayOptions: { show: showForEstimate },
		description: 'Optional per-piece detail. Weight is required on each piece; L/W/H are all-or-none.',
		options: [
			{
				name: 'piece',
				displayName: 'Piece',
				values: [
					{ displayName: 'Weight', name: 'weight', type: 'number', default: 0, typeOptions: { minValue: 0 } },
					{ displayName: 'Length', name: 'length', type: 'number', default: 0, typeOptions: { minValue: 0 } },
					{ displayName: 'Width', name: 'width', type: 'number', default: 0, typeOptions: { minValue: 0 } },
					{ displayName: 'Height', name: 'height', type: 'number', default: 0, typeOptions: { minValue: 0 } },
				],
			},
		],
	},

	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		default: {},
		placeholder: 'Add Option',
		displayOptions: { show: showForEstimate },
		description: 'High-frequency shipment options',
		options: [
			{ displayName: 'Adult Signature Required', name: 'adultSignatureRequired', type: 'boolean', default: false },
			{ displayName: 'Dangerous Goods', name: 'dangerousGoods', type: 'boolean', default: false },
			{
				displayName: 'Dangerous Goods Class',
				name: 'dangerousGoodsClass',
				type: 'options',
				default: '',
				options: [
					{ name: '(None)', value: '' },
					{ name: 'Fully Regulated', value: 'FullyRegulated' },
					{ name: 'Less Than 500kg Exempt', value: 'LessThan500kgExempt' },
					{ name: 'Limited Quantities', value: 'LimitedQuantities' },
					{ name: 'UN1845', value: 'UN1845' },
					{ name: 'UN3373', value: 'UN3373' },
				],
			},
			{
				displayName: 'Dangerous Goods Mode',
				name: 'dangerousGoodsMode',
				type: 'options',
				default: '',
				options: [
					{ name: '(None)', value: '' },
					{ name: 'Air', value: 'Air' },
					{ name: 'Ground', value: 'Ground' },
				],
			},
			{ displayName: 'Declared Value', name: 'declaredValue', type: 'number', default: 0, typeOptions: { minValue: 0 } },
			{ displayName: 'Hold For Pickup', name: 'holdForPickup', type: 'boolean', default: false },
			{ displayName: 'Residential Signature (Domestic)', name: 'residentialSignatureDomestic', type: 'boolean', default: false },
		],
	},

	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		default: {},
		placeholder: 'Add Option',
		displayOptions: { show: showForEstimate },
		description: 'Long-tail or future option IDs as raw optionId / optionIdValue pairs',
		options: [
			{
				name: 'option',
				displayName: 'Option',
				values: [
					{ displayName: 'Option ID', name: 'optionId', type: 'string', default: '' },
					{ displayName: 'Option ID Value', name: 'optionIdValue', type: 'string', default: '', description: 'Defaults to "true" when blank' },
				],
			},
		],
	},

	{
		displayName: 'Language',
		name: 'language',
		type: 'options',
		options: [
			{ name: 'English', value: 'en' },
			{ name: 'French', value: 'fr' },
		],
		default: 'en',
		displayOptions: { show: showForEstimate },
		description: 'Language for customer-facing response text (sent as the Language header)',
	},
	{
		displayName: 'Request Reference',
		name: 'requestReference',
		type: 'string',
		default: '',
		displayOptions: { show: showForEstimate },
		description: 'Optional client reference echoed back by the carrier (sent as the RequestReference header)',
	},
	{
		displayName: 'Split Results',
		name: 'splitResults',
		type: 'boolean',
		default: true,
		displayOptions: { show: showForEstimate },
		description:
			'Whether to emit one item per eligible service. When off, all services are returned as an array on a single item.',
	},
];
