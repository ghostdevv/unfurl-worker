import { BlueMicrocosmIdentityResolveMiniDoc } from '@atcute/microcosm';
import { SiteStandardDocument } from '@atcute/standard-site';
import { isBlob } from '@atcute/lexicons/interfaces';
import { isValidURL, USER_AGENT } from './utils';
import {
	type BaseSchema,
	type InferInput,
	is,
} from '@atcute/lexicons/validations';
import {
	parseResourceUri,
	type ResourceUri,
	type Did,
	isDid,
} from '@atcute/lexicons/syntax';

export function isWantedDid(input: unknown): input is Did<'plc'> | Did<'web'> {
	return (
		isDid(input) &&
		(input.startsWith('did:plc:') || input.startsWith('did:web:'))
	);
}

async function slingshot<T extends BaseSchema>(
	xrpc: string,
	schema: T,
	params: Record<string, string>,
	key?: string,
): Promise<InferInput<T> | null> {
	const url = new URL('https://slingshot.microcosm.blue');
	url.pathname = `/xrpc/${xrpc}`;

	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}

	const response = await fetch(url, {
		headers: {
			'User-Agent': USER_AGENT,
			Accept: 'application/json',
		},
	});

	let data: Record<string, unknown> = await response.json();
	if (key) data = data[key] as Record<string, unknown>;
	return is(schema, data) ? data : null;
}

export async function getStandardSiteDocument(uri: ResourceUri) {
	const params = parseResourceUri(uri);

	if (!params.rkey) {
		console.error('standard site uri missing rkey', uri, params);
		return null;
	}

	if (!isWantedDid(params.repo)) {
		console.error('standard site uri has invalid repo did', uri, params);
		return null;
	}

	const document = await slingshot(
		'blue.microcosm.repo.getRecordByUri',
		SiteStandardDocument.mainSchema,
		{ at_uri: uri },
		'value',
	);

	if (!document) {
		console.error('record not valid', uri, params, document);
		return null;
	}

	const miniDoc = await slingshot(
		'blue.microcosm.identity.resolveMiniDoc',
		BlueMicrocosmIdentityResolveMiniDoc.mainSchema.output.schema,
		{ identifier: params.repo },
	);

	if (!miniDoc || !isValidURL(miniDoc.pds)) {
		console.error('profile not valid', uri, params, miniDoc);
		return null;
	}

	let coverImage: string | null = null;

	if (document.coverImage) {
		const cid = isBlob(document.coverImage)
			? document.coverImage.ref.$link
			: document.coverImage?.cid;

		const url = new URL(miniDoc.pds);
		url.pathname += `${url.pathname.endsWith('/') ? '' : '/'}xrpc/com.atproto.sync.getBlob`;
		url.searchParams.set('did', params.repo);
		url.searchParams.set('cid', cid);
		coverImage = url.toString();
	}

	return {
		...document,
		coverImage,
	};
}
