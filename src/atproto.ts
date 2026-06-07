import { SiteStandardDocument } from '@atcute/standard-site';
import { Client, simpleFetchHandler } from '@atcute/client';
import { isBlob } from '@atcute/lexicons/interfaces';
import { is } from '@atcute/lexicons/validations';
import {
	parseResourceUri,
	type ResourceUri,
	type Did,
	isDid,
} from '@atcute/lexicons/syntax';
import {
	CompositeDidDocumentResolver,
	PlcDidDocumentResolver,
	WebDidDocumentResolver,
} from '@atcute/identity-resolver';

export function isWantedDid(input: unknown): input is Did<'plc'> | Did<'web'> {
	return (
		isDid(input) &&
		(input.startsWith('did:plc:') || input.startsWith('did:web:'))
	);
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

	const didResolver = new CompositeDidDocumentResolver({
		methods: {
			plc: new PlcDidDocumentResolver(),
			web: new WebDidDocumentResolver(),
		},
	});

	const doc = await didResolver.resolve(params.repo);
	const service = doc.service?.find((s) => s.id == '#atproto_pds');

	if (!service || typeof service.serviceEndpoint !== 'string') {
		console.error('did resolver unable to find pds', uri, params);
		return null;
	}

	const rpc = new Client({
		handler: simpleFetchHandler({ service: service.serviceEndpoint }),
	});

	const response = await rpc.get('com.atproto.repo.getRecord', {
		params: {
			collection: 'site.standard.document',
			rkey: params.rkey,
			repo: params.repo,
		},
	});

	if (!response.ok) {
		console.error('record fetch failed', uri, params, response);
		return null;
	}

	const document = response.data.value;

	if (!is(SiteStandardDocument.mainSchema, document)) {
		console.error('record not valid', uri, params, response);
		return null;
	}

	let coverImage: string | null = null;

	if (document.coverImage) {
		const cid = isBlob(document.coverImage)
			? document.coverImage.ref.$link
			: document.coverImage?.cid;

		const url = new URL(service.serviceEndpoint);
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
