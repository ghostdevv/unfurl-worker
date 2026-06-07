import { unfurl, type Attrs } from '../src/meta';
import { describe, it, expect } from 'vitest';

function page(meta: Attrs[], url = 'https://willow.sh') {
	const html = `<html><head>${meta.map((m) => `<meta ${'name' in m ? `name="${m.name}"` : `property="${m.property}"`} content="${m.content}" />`).join(' ')}</head></html>`;

	const res = new Response(html, {
		headers: { 'Content-Type': 'text/html' },
	});

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
});
