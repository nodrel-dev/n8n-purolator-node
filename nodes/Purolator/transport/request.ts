import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
} from 'n8n-workflow';
import {
	PUROLATOR_PRODUCTION_BASE_URL,
	PUROLATOR_SANDBOX_BASE_URL,
} from '../../../credentials/PurolatorApi.credentials';
import { withRetry } from './retry';

export const CREDENTIAL_NAME = 'purolatorApi';

/** Resolve the base URL from the credential's environment selector (FR-AUTH-008). */
export function getBaseUrl(environment: unknown): string {
	return environment === 'production' ? PUROLATOR_PRODUCTION_BASE_URL : PUROLATOR_SANDBOX_BASE_URL;
}

export interface PurolatorRequest {
	method: IHttpRequestMethods;
	path: string;
	body?: IDataObject;
	qs?: IDataObject;
	headers?: Record<string, string>;
}

/**
 * Make an authenticated Purolator API call. The Bearer token + x-api-key are injected by the
 * credential's authenticate block (and refreshed on 401); this helper layers on the bounded
 * retry/backoff policy (FR-X-003) and per-endpoint base URL + headers (FR-X-008). Secrets are
 * carried only in headers added by n8n, never in the URL (FR-X-004).
 */
export async function purolatorRequest(
	this: IExecuteFunctions,
	baseUrl: string,
	request: PurolatorRequest,
): Promise<unknown> {
	const options: IHttpRequestOptions = {
		method: request.method,
		url: `${baseUrl}${request.path}`,
		json: true,
		...(request.body ? { body: request.body } : {}),
		...(request.qs ? { qs: request.qs } : {}),
		...(request.headers ? { headers: request.headers } : {}),
	};

	return withRetry(() =>
		this.helpers.httpRequestWithAuthentication.call(this, CREDENTIAL_NAME, options),
	);
}
