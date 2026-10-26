import { isOwnBackend } from '#lib/shared/index';
import { error } from '@sveltejs/kit';

export async function GET() {
	const backend = isOwnBackend();
	if (!backend) throw error(404, 'Not found');

	return Response.json({
		...backend,
		version: import.meta.env.APP_VERSION,
		backend: 'materialious'
	});
}
