import { error, json } from '@sveltejs/kit';
import { isOwnBackend } from '$lib/shared/index';
import { getDownloadProgress } from '$lib/server/downloadProgress';

export async function GET({ url, locals }) {
	if (isOwnBackend()?.requireAuth && !locals.userId) {
		throw error(401);
	}

	const downloadId = url.searchParams.get('downloadId') ?? '';

	return json({ progress: getDownloadProgress(downloadId) });
}
