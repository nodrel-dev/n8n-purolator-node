import {
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { extractCarrierFault, redactSecrets } from './transforms/classifyError';
import { executeEstimate } from './operations/estimate';
import { estimateDescription } from './descriptions/estimate';

function dig(value: unknown, ...path: string[]): unknown {
	let current = value;
	for (const key of path) {
		if (current && typeof current === 'object') {
			current = (current as Record<string, unknown>)[key];
		} else {
			return undefined;
		}
	}
	return current;
}

function extractErrorBody(error: unknown): unknown {
	return (
		dig(error, 'response', 'body') ??
		dig(error, 'cause', 'response', 'body') ??
		dig(error, 'cause', 'error') ??
		dig(error, 'error') ??
		dig(error, 'message') ??
		error
	);
}

/** Build a structured, secret-free error item for continueOnFail (ADR-0004, FR-X-002/004). */
function toErrorItem(error: unknown, secrets: Array<string | undefined>): IDataObject {
	const fault = extractCarrierFault(extractErrorBody(error));
	return {
		error: {
			code: fault.code,
			message: redactSecrets(fault.message, secrets),
		},
	};
}

export class Purolator implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Purolator',
		name: 'purolator',
		icon: { light: 'file:purolator.svg', dark: 'file:purolator.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Estimate rates, track shipments, schedule pickups, and find service points with your own Purolator account',
		defaults: {
			name: 'Purolator',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'purolatorApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [{ name: 'Estimate', value: 'estimate' }],
				default: 'estimate',
			},
			...estimateDescription,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('purolatorApi');
		const secrets = [
			credentials.clientSecret as string,
			credentials.apiKey as string,
			credentials.xOriginVerify as string,
			credentials.sessionToken as string,
		];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;

				let results: IDataObject[];
				if (resource === 'estimate' && operation === 'estimate') {
					results = await executeEstimate.call(this, itemIndex);
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`The operation "${operation}" on resource "${resource}" is not supported.`,
						{ itemIndex },
					);
				}

				for (const json of results) {
					returnData.push({ json, pairedItem: { item: itemIndex } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: toErrorItem(error, secrets),
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}

		return [returnData];
	}
}
