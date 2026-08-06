import { error, isValidURL, STEALTH_USER_AGENT } from './utils';
import pkg from '../package.json' with { type: 'json' };
import { Result } from 'better-result';
import { unfurl } from './unfurl';
import { cors } from 'hono/cors';
import { Hono } from 'hono';

// oxlint-disable-next-line typescript/consistent-generic-constructors
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
	const ip = c.req.header('cf-connecting-ip') ?? '';
	const { success } = await c.env.RATE_LIMITS.limit({ key: ip });

	if (!success) {
		return error(429, 'Rate limit exceeded, try again in a minute');
	}

	const target = c.req.query('url');
	if (!isValidURL(target)) return error(400, 'Invalid URL');

	const res = await fetch(target, {
		headers: {
			'User-Agent': STEALTH_USER_AGENT,
			Accept: 'text/html',
		},
	});

	if (!res.ok) {
		return error(500, 'Failed to unfurl, please try again later');
	}

	const contentType = res.headers.get('Content-Type')?.split(';').at(0);

	if (contentType !== 'text/html') {
		return error(400, 'Response Content-Type is not text/html');
	}

	const result = await Result.tryPromise(async () => await unfurl(res));

	if (result.isErr()) {
		console.error('failed to unfurl', result.error);
		return error(500, 'failed to unfurl');
	}

	return c.json(result.value, {
		headers: {
			'Cache-Control':
				'public, max-age=3600, stale-while-revalidate=3600, stale-if-error=3600',
		},
	});
});

export default app;
