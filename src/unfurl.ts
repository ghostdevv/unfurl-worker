import { isResourceUri } from '@atcute/lexicons/syntax';
import { getStandardSiteDocument } from './atproto';
import * as v from 'valibot';

const StringSchema = v.pipe(v.string(), v.trim(), v.minLength(1));
const SafeStringSchema = v.fallback(v.nullable(StringSchema), null);
const URLSchema = v.pipe(StringSchema, v.url());

const AttrsSchema = v.union([
	v.object({ name: StringSchema, content: StringSchema }),
	v.object({ property: StringSchema, content: StringSchema }),
]);

export type Attrs = v.InferOutput<typeof AttrsSchema>;

const LinkSchema = v.object({ rel: StringSchema, href: StringSchema });

const MetaSchema = v.object({
	'og:url': v.fallback(v.nullable(URLSchema), null),
	title: SafeStringSchema,
	'og:title': SafeStringSchema,
	description: SafeStringSchema,
	'og:description': SafeStringSchema,
	'og:image': SafeStringSchema,
	'site.standard.document': v.pipe(
		SafeStringSchema,
		v.transform((input) => (isResourceUri(input) ? input : null)),
	),
	htmlTitle: SafeStringSchema,
});

interface UnfurlResult {
	url: string;
	title: string | null;
	description: string | null;
	image: string | null;
	standardSiteDocument: string | null;
}

function getAttributes(element: Element) {
	return [...element.attributes].reduce(
		// oxlint-disable-next-line no-sequences
		(o, [k, v]) => ((o[k] = v), o),
		// oxlint-disable-next-line typescript/prefer-reduce-type-parameter
		{} as Record<string, string>,
	);
}

export async function unfurl(response: Response): Promise<UnfurlResult | null> {
	const meta: Record<string, string> = {}; // todo split up meta and link into sub objects
	const url = new URL(response.url);
	let htmlTitleFinished = false;

	await new HTMLRewriter()
		.on('meta', {
			element(element) {
				const parsed = v.safeParse(AttrsSchema, getAttributes(element));
				if (!parsed.success) return;

				const key =
					'name' in parsed.output
						? parsed.output.name
						: parsed.output.property;

				meta[key] ??= parsed.output.content;
			},
		})
		.on('link', {
			element(element) {
				const parsed = v.safeParse(LinkSchema, getAttributes(element));
				if (!parsed.success) return;
				meta[parsed.output.rel] = parsed.output.href;
			},
		})
		.on('title', {
			text({ text, lastInTextNode }) {
				if (htmlTitleFinished && meta.htmlTitle) return;
				htmlTitleFinished = lastInTextNode;
				meta.htmlTitle ??= '';
				meta.htmlTitle += text;
			},
		})
		.transform(response)
		.text();

	const parsed = v.safeParse(MetaSchema, meta);
	if (!parsed.success) return null;

	const standardSiteDocumentURI = parsed.output['site.standard.document'];
	const standardSiteDocument = standardSiteDocumentURI
		? await getStandardSiteDocument(standardSiteDocumentURI)
		: null;

	const result: UnfurlResult = {
		url: parsed.output['og:url'] ?? response.url,
		title:
			standardSiteDocument?.title ??
			parsed.output['og:title'] ??
			parsed.output.title ??
			parsed.output.htmlTitle,
		description:
			standardSiteDocument?.description ??
			parsed.output['og:description'] ??
			parsed.output.description,
		image: standardSiteDocument?.coverImage ?? parsed.output['og:image'],
		standardSiteDocument: standardSiteDocumentURI,
	};

	// todo generic
	if (!result.title && url.hostname == 'github.com') {
		const [, owner, repo] = url.pathname.split('/');

		if (owner?.trim() && repo?.trim()) {
			result.title = `GitHub - ${owner}/${repo}`;
		}
	}

	return result;
}
