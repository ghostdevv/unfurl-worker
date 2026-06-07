import pkg from '../package.json' with { type: 'json' };
import type { HonoEnv } from './types';
import { Result } from 'better-result';
import { logger } from 'hono/logger';
import { unfurl } from './meta';
import { error } from './utils';
import { Hono } from 'hono';

const app = new Hono<HonoEnv>();

app.use('*', logger());

function isURL(url?: string): url is string {
	if (!url) return false;
	const parsed = URL.parse(url);
	return parsed?.protocol === 'http:' || parsed?.protocol === 'https:';
}

app.get('/v0', async (c) => {
	const target = c.req.query('url');
	if (!isURL(target)) return error(400, 'Invalid URL');

	const response = await fetch(target, {
		headers: {
			'User-Agent': `unfurl-worker/${pkg.version} (+https://github.com/ghostdevv/unfurl-worker)`,
			Accept: 'text/html',
		},
	});

	const contentType = response.headers.get('Content-Type')?.split(';').at(0);

	if (contentType !== 'text/html') {
		return error(400, 'Response Content-Type is not text/html');
	}

	const result = await Result.tryPromise(async () => await unfurl(response));

	if (result.isErr()) {
		console.error('failed to unfurl', result.error);
		return error(500, 'failed to unfurl');
	}

	return c.json(result.value, {
		headers: {
			'Cache-Control': 'public, max-age=3600, stale-if-error=10800',
		},
	});
});

export default app;
