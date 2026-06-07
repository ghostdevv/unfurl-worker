export function error(code: number, error: string) {
	return Response.json({ error }, { status: code });
}
