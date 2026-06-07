import { describe, it, expect } from 'vitest';
import worker from './index';

const MOCK_URL = 'http://vitest/';

describe('cors', () => {
	it('should return wildcard access control', async () => {
		const response = await worker.fetch(
			new Request(MOCK_URL, { method: 'GET' }),
		);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
	});

	it('should return preflight headers', async () => {
		const response = await worker.fetch(
			new Request(MOCK_URL, { method: 'OPTIONS' }),
		);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
		expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
			'GET,HEAD,PUT,POST,DELETE,PATCH',
		);
	});
});
