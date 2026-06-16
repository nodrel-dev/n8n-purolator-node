import { defineConfig } from 'vitest/config';

// Scoped to the pure transforms (Constitution Principle 10 — test-first). Co-located *.test.mts.
export default defineConfig({
	test: {
		include: ['nodes/**/*.test.mts'],
		environment: 'node',
	},
});
