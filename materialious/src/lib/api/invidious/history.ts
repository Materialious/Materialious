import { buildAuthHeaders, buildPath, fetchErrorHandle } from './request';

export async function postHistoryInvidious(videoId: string, fetchOptions: RequestInit = {}) {
	await fetchErrorHandle(
		await fetch(buildPath(`auth/history/${videoId}`), {
			method: 'POST',
			...buildAuthHeaders(),
			...fetchOptions
		})
	);
}
