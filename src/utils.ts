import pkg from '../package.json' with { type: 'json' };

export const REAL_USER_AGENT = `unfurl-worker/${pkg.version} (+https://github.com/ghostdevv/unfurl-worker)`;
export const STEALTH_USER_AGENT = `Mozilla/5.0 (X11; Linux x86_64; rv:151.0) Gecko/20100101 Firefox/151.0`;

export function error(code: number, error: string) {
	return Response.json({ error }, { status: code });
}

export function isValidURL(url?: string): url is string {
	if (!url) return false;
	const parsed = URL.parse(url);
	return parsed?.protocol === 'http:' || parsed?.protocol === 'https:';
}
