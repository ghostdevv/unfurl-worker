import { isWantedDid, getStandardSiteDocument } from './atproto';
import har from '../tests/atproto.har.json' with { type: 'json' };
import { fromTraffic } from '@msw/source/traffic';
import { setupNetwork } from '@msw/cloudflare';
import type { Har } from 'har-format';
import {
	beforeAll,
	afterEach,
	afterAll,
	describe,
	expect,
	it,
	vi,
} from 'vitest';

describe('isWantedDid', () => {
	it('returns true for valid did:plc: DIDs', () => {
		expect(isWantedDid('did:plc:abc123')).toBe(true);
		expect(isWantedDid('did:plc:abcdefghijklmnopqrstuvwxyz')).toBe(true);
		expect(isWantedDid('did:plc:0123456789abcdef')).toBe(true);
	});

	it('returns true for valid did:web: DIDs', () => {
		expect(isWantedDid('did:web:example.com')).toBe(true);
		expect(isWantedDid('did:web:identity.example.com')).toBe(true);
	});

	it('returns false for null', () => {
		expect(isWantedDid(null)).toBe(false);
	});

	it('returns false for undefined', () => {
		// oxlint-disable-next-line no-undefined unicorn/no-useless-undefined
		expect(isWantedDid(undefined)).toBe(false);
	});

	it('returns false for non-string primitives', () => {
		expect(isWantedDid(123)).toBe(false);
		expect(isWantedDid(true)).toBe(false);
		expect(isWantedDid(false)).toBe(false);
	});

	it('returns false for empty string', () => {
		expect(isWantedDid('')).toBe(false);
	});

	it('returns false for strings starting with did: but not plc or web', () => {
		expect(isWantedDid('did:net:example')).toBe(false);
		expect(isWantedDid('did:email:foo@bar.com')).toBe(false);
		expect(isWantedDid('did:foo:bar')).toBe(false);
	});

	it('returns false for did:plc: with invalid format', () => {
		expect(isWantedDid('did:plc:')).toBe(false);
		expect(isWantedDid('did:plc')).toBe(false);
	});

	it('returns false for did:web: with invalid format', () => {
		expect(isWantedDid('did:web:')).toBe(false);
		expect(isWantedDid('did:web')).toBe(false);
	});

	it('returns false for objects and arrays', () => {
		expect(isWantedDid({})).toBe(false);
		expect(isWantedDid([])).toBe(false);
		expect(isWantedDid(['did:plc:123'])).toBe(false);
	});

	it('returns false for did:plc: and did:web: with empty identifier', () => {
		expect(isWantedDid('did:plc:')).toBe(false);
		expect(isWantedDid('did:web:')).toBe(false);
	});
});

describe('getStandardSiteDocument', () => {
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

	it('fails when rkey is missing', async () => {
		// oxlint-disable-next-line no-empty-function
		const spy = vi.spyOn(console, 'error').mockImplementationOnce(() => {});
		const result = await getStandardSiteDocument(
			// @ts-expect-error tests
			TEST_URI.slice(0, -TEST_URI.lastIndexOf('/')),
		);

		expect(result).toBeNull();
		expect(spy).toHaveBeenCalledOnce();
	});

	it('fails when did is invalid', async () => {
		// oxlint-disable-next-line no-empty-function
		const spy = vi.spyOn(console, 'error').mockImplementationOnce(() => {});
		const result = await getStandardSiteDocument(
			// @ts-expect-error tests
			TEST_URI.replace('did:plc', 'did:wow'),
		);

		expect(result).toBeNull();
		expect(spy).toHaveBeenCalledOnce();
	});

	it('returns the parsed document on success', async () => {
		network.use(...fromTraffic(har as Har));
		const result = await getStandardSiteDocument(TEST_URI);

		expect(result).not.toBeNull();
		expect(result).toHaveProperty('title');
	});

	it('normalises the cover image to a url', async () => {
		network.use(...fromTraffic(har as Har));
		const result = await getStandardSiteDocument(TEST_URI);

		expect(result).not.toBeNull();
		expect(result).toHaveProperty('coverImage');
		expect(result?.coverImage).toBe(
			'https://npmx.social/xrpc/com.atproto.sync.getBlob?did=did%3Aplc%3Adfkjiu36xs6ogt7pux7i7o2b&cid=bafkreihghmxb42uk4qxwpbgtylbujavdl3w24au3sk2gki7xxkhohvy55a',
		);
	});
});
