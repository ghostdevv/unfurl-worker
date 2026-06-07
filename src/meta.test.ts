import { describe, it, expect, afterEach, afterAll, beforeAll } from 'vitest';
import har from '../tests/atproto.har.json' with { type: 'json' };
import { getStandardSiteDocument } from './atproto';
import { fromTraffic } from '@msw/source/traffic';
import { setupNetwork } from '@msw/cloudflare';
import { unfurl, type Attrs } from './meta';
import type { Har } from 'har-format';

interface PageLink {
	rel: string;
	href: string;
}

function page(tags: (Attrs | PageLink)[], url = 'https://willow.sh') {
	const links = tags.filter((t): t is PageLink => 'rel' in t);
	const meta = tags.filter((t): t is Attrs => !('rel' in t));

	const html = `<html>
        <head>
            ${meta.map((m) => `<meta ${'name' in m ? `name="${m.name}"` : `property="${m.property}"`} content="${m.content}" />`).join('\n')}
            ${links.map((l) => `<link rel="${l.rel}" href="${l.href}" />`).join(' ')}
        </head>
    </html>`;

	// prettier-ignore
	const res = new Response(html, { headers: { 'Content-Type': 'text/html' } });
	Object.defineProperty(res, 'url', { value: url });
	return res;
}

describe('unfurl', () => {
	describe('url', () => {
		it('finds url', async () => {
			const url = 'https://example.com/page';
			const result = await unfurl(
				page([{ property: 'og:url', content: url }]),
			);
			expect(result).toMatchObject({ url });
		});

		it('falls back to given url if no url meta is found', async () => {
			const response = page([], 'https://example.com/foo');
			const result = await unfurl(response);
			expect(result?.url).toBe('https://example.com/foo');
		});

		it('uses og:url over response.url when present', async () => {
			const url = 'https://example.com/page';
			const result = await unfurl(
				page([{ property: 'og:url', content: url }], url),
			);
			expect(result).toMatchObject({ url });
		});

		it("invalid url doesn't fail parsing", async () => {
			const title = crypto.randomUUID();
			const result = await unfurl(
				page([
					{ property: 'og:title', content: title },
					{ property: 'og:url', content: 'foo' },
				]),
			);
			expect(result).toMatchObject({ title });
		});
	});

	describe('title', () => {
		it('finds title', async () => {
			const title = crypto.randomUUID();
			const result = await unfurl(
				page([{ name: 'title', content: title }]),
			);
			expect(result).toMatchObject({ title });
		});

		it('finds og:title', async () => {
			const ogTitle = crypto.randomUUID();
			const result = await unfurl(
				page([{ property: 'og:title', content: ogTitle }]),
			);
			expect(result).toMatchObject({ title: ogTitle });
		});

		it('og:title has higher priority than title', async () => {
			const title = crypto.randomUUID();
			const ogTitle = crypto.randomUUID();
			const result = await unfurl(
				page([
					{ name: 'title', content: title },
					{ property: 'og:title', content: ogTitle },
				]),
			);
			expect(result).toMatchObject({ title: ogTitle });
			expect(result!.title).not.toBe(title);
		});

		it("invalid title doesn't fail parsing", async () => {
			const ogTitle = crypto.randomUUID();
			const result = await unfurl(
				page([
					{ name: 'title', content: '' },
					{ property: 'og:title', content: ogTitle },
				]),
			);
			expect(result).toMatchObject({ title: ogTitle });
		});
	});

	describe('description', () => {
		it('finds description', async () => {
			const description = crypto.randomUUID();
			const result = await unfurl(
				page([{ name: 'description', content: description }]),
			);
			expect(result).toMatchObject({ description });
		});

		it('finds og:description', async () => {
			const description = crypto.randomUUID();
			const result = await unfurl(
				page([{ property: 'og:description', content: description }]),
			);
			expect(result).toMatchObject({ description });
		});

		it('og:description has higher priority than description', async () => {
			const description = crypto.randomUUID();
			const ogDescription = crypto.randomUUID();
			const result = await unfurl(
				page([
					{ name: 'description', content: description },
					{ property: 'og:description', content: ogDescription },
				]),
			);
			expect(result).toMatchObject({ description: ogDescription });
			expect(result!.description).not.toBe(description);
		});

		it("missing value doesn't fail parsing", async () => {
			const description = crypto.randomUUID();
			const result = await unfurl(
				page([
					{ name: 'description', content: '' },
					{ property: 'og:description', content: description },
				]),
			);
			expect(result).toMatchObject({ description });
		});
	});

	describe('image', () => {
		it('finds og:image', async () => {
			const imageUrl = 'https://example.com/image.jpg';
			const result = await unfurl(
				page([{ property: 'og:image', content: imageUrl }]),
			);
			expect(result).toMatchObject({ image: imageUrl });
		});

		it("invalid image url doesn't fail parsing", async () => {
			const result = await unfurl(
				page([{ property: 'og:image', content: 'not-a-url' }]),
			);
			expect(result).toMatchObject({ image: 'not-a-url' });
		});
	});

	describe('github fallback title', () => {
		it('generates title for a github repo url', async () => {
			const result = await unfurl(
				page([], 'https://github.com/owner/repo'),
			);
			expect(result).toMatchObject({ title: 'GitHub - owner/repo' });
		});

		it('does not override existing title on github', async () => {
			const title = crypto.randomUUID();
			const result = await unfurl(
				page(
					[{ name: 'title', content: title }],
					'https://github.com/owner/repo',
				),
			);
			expect(result).toMatchObject({ title });
		});

		it('does not override existing og:title on github', async () => {
			const ogTitle = crypto.randomUUID();
			const result = await unfurl(
				page(
					[{ property: 'og:title', content: ogTitle }],
					'https://github.com/owner/repo',
				),
			);
			expect(result).toMatchObject({ title: ogTitle });
		});

		it('does not generate fallback for github root', async () => {
			const result = await unfurl(page([], 'https://github.com'));
			expect(result?.title).toBeNull();
		});

		it('does not generate fallback for github user page', async () => {
			const result = await unfurl(page([], 'https://github.com/user'));
			expect(result?.title).toBeNull();
		});

		it('does not generate fallback for non-github url', async () => {
			const result = await unfurl(page([], 'https://example.com'));
			expect(result?.title).toBeNull();
		});
	});

	describe('standard site document', () => {
		const TEST_URI =
			'at://did:plc:dfkjiu36xs6ogt7pux7i7o2b/site.standard.document/3mgeb2zdgsn22';

		const network = setupNetwork();

		beforeAll(() => {
			network.enable();
		});

		afterEach(() => {
			network.resetHandlers();
		});

		afterAll(() => {
			network.disable();
		});

		describe('link field', () => {
			it('extracts valid site.standard.document link', async () => {
				network.use(...fromTraffic(har as Har));
				const result = await unfurl(
					page(
						[{ rel: 'site.standard.document', href: TEST_URI }],
						'https://example.com',
					),
				);
				expect(result?.standardSiteDocument).toBe(TEST_URI);
			});

			it('rejects invalid site.standard.document link', async () => {
				const result = await unfurl(
					page(
						[{ rel: 'site.standard.document', href: 'not-a-uri' }],
						'https://example.com',
					),
				);
				expect(result?.standardSiteDocument).toBeNull();
			});

			it('is null when no link is present', async () => {
				const result = await unfurl(page([], 'https://example.com'));
				expect(result?.standardSiteDocument).toBeNull();
			});
		});

		it('returns standardSiteDocument URI when link is present', async () => {
			network.use(...fromTraffic(har as Har));
			const result = await unfurl(
				page(
					[{ rel: 'site.standard.document', href: TEST_URI }],
					'https://example.com',
				),
			);
			expect(result?.standardSiteDocument).toBe(TEST_URI);
		});

		it('standard site title takes precedence over og:title and title', async () => {
			network.use(...fromTraffic(har as Har));
			const result = await unfurl(
				page(
					[
						{ name: 'title', content: 'plain-title' },
						{ property: 'og:title', content: 'og-title' },
						{ rel: 'site.standard.document', href: TEST_URI },
					],
					'https://example.com',
				),
			);

			// Verify standard site document was fetched and has its own title
			const doc = await getStandardSiteDocument(TEST_URI);
			expect(doc?.title).not.toBeNull();
			expect(doc?.title).not.toBe('og-title');
			expect(doc?.title).not.toBe('plain-title');

			expect(result?.title).toBe(doc?.title);
			expect(result?.title).not.toBe('og-title');
			expect(result?.title).not.toBe('plain-title');
		});

		it('standard site description takes precedence over og:description and description', async () => {
			network.use(...fromTraffic(har as Har));
			const result = await unfurl(
				page(
					[
						{ name: 'description', content: 'plain-desc' },
						{ property: 'og:description', content: 'og-desc' },
						{ rel: 'site.standard.document', href: TEST_URI },
					],
					'https://example.com',
				),
			);

			// Verify standard site document has its own description
			const doc = await getStandardSiteDocument(TEST_URI);
			expect(doc?.description).not.toBeNull();

			expect(result?.description).toBe(doc?.description);
			expect(result?.description).not.toBe('og-desc');
			expect(result?.description).not.toBe('plain-desc');
		});

		it('standard site coverImage takes precedence over og:image', async () => {
			network.use(...fromTraffic(har as Har));
			const result = await unfurl(
				page(
					[
						{
							property: 'og:image',
							content: 'https://example.com/og-image.jpg',
						},
						{ rel: 'site.standard.document', href: TEST_URI },
					],
					'https://example.com',
				),
			);

			// Verify standard site document has a coverImage
			const doc = await getStandardSiteDocument(TEST_URI);
			expect(doc?.coverImage).not.toBeNull();

			expect(result?.image).toBe(doc?.coverImage);
			expect(result?.image).not.toBe('https://example.com/og-image.jpg');
		});
	});
});
