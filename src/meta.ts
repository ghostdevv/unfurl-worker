import * as v from 'valibot';

const StringSchema = v.pipe(v.string(), v.trim(), v.minLength(1));
const SafeStringSchema = v.fallback(v.nullable(StringSchema), null);

const AttrsSchema = v.union([
	v.object({ name: StringSchema, content: StringSchema }),
	v.object({ property: StringSchema, content: StringSchema }),
]);

export type Attrs = v.InferOutput<typeof AttrsSchema>;

const MetaSchema = v.object({
	'og:url': v.fallback(v.nullable(v.pipe(StringSchema, v.url())), null),
	title: SafeStringSchema,
	'og:title': SafeStringSchema,
	description: SafeStringSchema,
	'og:description': SafeStringSchema,
	'og:image': SafeStringSchema,
});

interface UnfurlResult {
	url: string;
	title: string | null;
	description: string | null;
	image: string | null;
}

export async function unfurl(response: Response): Promise<UnfurlResult | null> {
	const meta: Record<string, string> = {}; // todo split up meta and link into sub objects
	const url = new URL(response.url);

	const rewriter = new HTMLRewriter().on('meta', {
		element(element) {
			const attrs = [...element.attributes].reduce(
				// oxlint-disable-next-line no-sequences
				(o, [k, v]) => ((o[k] = v), o),
				// oxlint-disable-next-line typescript/prefer-reduce-type-parameter
				{} as Record<string, string>,
			);

			const parsed = v.safeParse(AttrsSchema, attrs);
			if (!parsed.success) return;

			const key =
				'name' in parsed.output
					? parsed.output.name
					: parsed.output.property;

			meta[key] ??= parsed.output.content;
		},
	});

	await rewriter.transform(response).text();

	const parsed = v.safeParse(MetaSchema, meta);
	if (!parsed.success) return null;

	const result: UnfurlResult = {
		url: parsed.output['og:url'] ?? response.url,
		title: parsed.output['og:title'] ?? parsed.output.title,
		description:
			parsed.output['og:description'] ?? parsed.output.description,
		image: parsed.output['og:image'],
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
