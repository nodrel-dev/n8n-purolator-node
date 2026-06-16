// Split Results output shaping (FR-X-009). Pure: no n8n imports. Tested first (Principle 10).

export type JsonRecord = Record<string, unknown>;

/**
 * Shape a multi-result operation's output.
 *  - split = true  (default): one output item per result element.
 *  - split = false: a single item carrying the results as a nested array under `nestedKey`.
 *
 * Behaves identically on the normal and AI-Agent tool-execution paths (FR-X-006).
 */
export function splitResults(
	results: JsonRecord[],
	split: boolean,
	nestedKey: string,
): JsonRecord[] {
	if (split) {
		return results;
	}
	return [{ [nestedKey]: results }];
}
