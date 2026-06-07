import { describe, expect, it } from 'vitest';
import { error, isValidURL } from './utils';

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

describe('isValidURL', () => {
	it('returns true for valid http URLs', () => {
		expect(isValidURL('http://example.com')).toBe(true);
		expect(isValidURL('http://localhost:3000/path')).toBe(true);
	});

	it('returns true for valid https URLs', () => {
		expect(isValidURL('https://example.com')).toBe(true);
		expect(isValidURL('https://example.com/path?query=1')).toBe(true);
	});

	it('returns false for undefined', () => {
		// oxlint-disable-next-line no-undefined unicorn/no-useless-undefined
		expect(isValidURL(undefined)).toBe(false);
	});

	it('returns false for null', () => {
		expect(isValidURL(null as unknown as string)).toBe(false);
	});

	it('returns false for empty string', () => {
		expect(isValidURL('')).toBe(false);
	});

	it('returns false for non-http protocols', () => {
		expect(isValidURL('ftp://example.com')).toBe(false);
		expect(isValidURL('mailto:test@example.com')).toBe(false);
		expect(isValidURL('data:text/plain,hello')).toBe(false);
	});

	it('returns false for malformed URLs', () => {
		expect(isValidURL('not a url')).toBe(false);
	});
});
