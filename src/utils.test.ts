import { describe, expect, it } from 'vitest';
import { error } from './utils';

describe('error', () => {
	it('returns a JSON response with the given status code and error message', async () => {
		const res = error(404, 'Not Found');

		expect(res instanceof Response).toBe(true);
		expect(res.status).toBe(404);
		expect(res.headers.get('content-type')).toContain('application/json');
		await expect(res.json()).resolves.toEqual({ error: 'Not Found' });
	});

	it('uses the provided error string', async () => {
		const res = error(500, 'Internal Server Error');
		await expect(res.json()).resolves.toEqual({
			error: 'Internal Server Error',
		});
	});

	it('works with status code 400', async () => {
		const res = error(400, 'Bad Request');
		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toEqual({ error: 'Bad Request' });
	});
});
