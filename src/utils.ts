import pkg from '../package.json' with { type: 'json' };

export const USER_AGENT = `unfurl-worker/${pkg.version} (+https://github.com/ghostdevv/unfurl-worker)`;

export function error(code: number, error: string) {
	return Response.json({ error }, { status: code });
}

export function isValidURL(url?: string): url is string {
	if (!url) return false;
	const parsed = URL.parse(url);
	return parsed?.protocol === 'http:' || parsed?.protocol === 'https:';
}
