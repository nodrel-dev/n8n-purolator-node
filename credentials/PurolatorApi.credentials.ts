import type {
	IAuthenticateGeneric,
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IDataObject,
	IHttpRequestHelper,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export const PUROLATOR_SANDBOX_BASE_URL = 'https://shipapi-sandbox.purolator.com';
export const PUROLATOR_PRODUCTION_BASE_URL = 'https://shipapi.purolator.com';

const BASE_URL_EXPRESSION =
	'={{$credentials.environment === "production" ? "https://shipapi.purolator.com" : "https://shipapi-sandbox.purolator.com"}}';

/**
 * Single Purolator credential covering all v1 APIs (ADR-0001, FR-AUTH-001/007).
 *
 * Purolator's token endpoint takes an application/json body with HTTP Basic auth, which n8n's
 * built-in form-encoded OAuth2 client-credentials grant cannot send — so this is a custom
 * credential. `preAuthentication` fetches and caches the Bearer token; `authenticate` injects
 * `Authorization: Bearer <token>` + `x-api-key` on every request. n8n re-runs preAuthentication
 * on a 401 (refresh-on-401); there is no proactive pre-expiry refresh.
 */
export class PurolatorApi implements ICredentialType {
	name = 'purolatorApi';

	displayName = 'Purolator API';

	documentationUrl = 'https://github.com/nodrel-dev/n8n-purolator-node#credentials';

	icon: Icon = { light: 'file:purolator.svg', dark: 'file:purolator.dark.svg' };

	properties: INodeProperties[] = [
		{
			displayName: 'Environment',
			name: 'environment',
			type: 'options',
			options: [
				{ name: 'Sandbox (Test)', value: 'sandbox' },
				{ name: 'Production (Live)', value: 'production' },
			],
			default: 'sandbox',
			description:
				'Which Purolator environment to target. Defaults to sandbox so a half-configured connection cannot bill a live account.',
		},
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			required: true,
			description: 'Your Purolator API client ID (the HTTP Basic username for the token call)',
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Your Purolator API client secret (the HTTP Basic password for the token call)',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'The X-Api-Key sent on every API request (provisioned with your portal App)',
		},
		{
			displayName: 'Origin Verify Token',
			name: 'xOriginVerify',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'Optional x-origin-verify token. Only required by the Service Point (Locator) operation; leave blank otherwise.',
		},
		{
			displayName: 'Default Account Number',
			name: 'defaultAccountNumber',
			type: 'string',
			default: '',
			description:
				'Optional default Purolator account number. Used for Estimate billing and Pickup when an operation does not override it. Not part of the credential test.',
		},
	];

	async preAuthentication(
		this: IHttpRequestHelper,
		credentials: ICredentialDataDecryptedObject,
	): Promise<IDataObject> {
		const baseUrl =
			credentials.environment === 'production'
				? PUROLATOR_PRODUCTION_BASE_URL
				: PUROLATOR_SANDBOX_BASE_URL;
		const basic = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString(
			'base64',
		);

		const response = (await this.helpers.httpRequest({
			method: 'POST',
			url: `${baseUrl}/auth/v1/token`,
			headers: {
				Authorization: `Basic ${basic}`,
				'Content-Type': 'application/json',
			},
			body: { grant_type: 'client_credentials', scope: 'portal_api' },
			json: true,
		})) as { access_token?: string };

		if (!response?.access_token) {
			throw new Error('Purolator token endpoint did not return an access_token.');
		}

		return { sessionToken: response.access_token };
	}

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.sessionToken}}',
				'x-api-key': '={{$credentials.apiKey}}',
			},
		},
	};

	// Non-billable validation: preAuthentication fetches a token (fails fast on bad client
	// credentials), then this lightweight Service Point lookup confirms the token + API key are
	// accepted by the data plane.
	test: ICredentialTestRequest = {
		request: {
			baseURL: BASE_URL_EXPRESSION,
			url: '/locator/v1/address',
			method: 'GET',
			qs: {
				language: 'en',
				requestReference: 'n8n-credential-test',
				postalCode: 'L4W5M8',
			},
			headers: {
				'x-origin-verify': '={{$credentials.xOriginVerify}}',
			},
		},
	};
}
