import pkg from '../package.json' with { type: 'json' };
import { error, isValidURL } from './utils';
import { Result } from 'better-result';
import { cors } from 'hono/cors';
import { unfurl } from './meta';
import { Hono } from 'hono';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

// oxlint-disable-next-line promise/prefer-await-to-callbacks
app.onError((err, _c) => {
	console.error('hono found error', err);
	return error(500, 'Internal Server Error');
});

// oxlint-disable-next-line promise/prefer-await-to-callbacks
app.notFound((_c) => {
	return error(404, 'Route not found');
});

app.get('/', (c) => {
	return c.text(`              ___         __                    __
   __ _____  / _/_ ______/ /____    _____  ____/ /_____ ____
  / // / _ \\/ _/ // / __/ /___/ |/|/ / _ \\/ __/  '_/ -_) __/
  \\_,_/_//_/_/ \\_,_/_/ /_/    |__,__/\\___/_/ /_/\\_\\__/_/


  Unfurl Worker v${pkg.version}

  https://github.com/ghostdevv/unfurl-worker
`);
});

app.get('/v0', async (c) => {
	const cacheKey = new Request(c.req.url, c.req);
	// const cachedResponse = await caches.default.match(cacheKey);
	// if (cachedResponse) return cachedResponse;

	const target = c.req.query('url');
	if (!isValidURL(target)) return error(400, 'Invalid URL');

	const res = await fetch(target, {
		headers: {
			'User-Agent': `unfurl-worker/${pkg.version} (+https://github.com/ghostdevv/unfurl-worker)`,
			Accept: 'text/html',
		},
	});

	const contentType = res.headers.get('Content-Type')?.split(';').at(0);

	if (contentType !== 'text/html') {
		return error(400, 'Response Content-Type is not text/html');
	}

	const result = await Result.tryPromise(async () => await unfurl(res));

	if (result.isErr()) {
		console.error('failed to unfurl', result.error);
		return error(500, 'failed to unfurl');
	}

	const response = c.json(result.value, {
		headers: {
			'Cache-Control': 'public, max-age=3600, stale-if-error=10800',
		},
	});

	c.executionCtx.waitUntil(caches.default.put(cacheKey, response.clone()));
	return response;
});

export default app;
