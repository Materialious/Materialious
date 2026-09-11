import { getMaterialiousAuthHeaders, getMaterialiousBackendUrl } from '$lib/backend';

export function backendFetch(path: string, options: RequestInit = {}): Promise<Response> {
	const url = `${getMaterialiousBackendUrl()}${path}`;

	return fetch(url, {
		...options,
		headers: {
			...getMaterialiousAuthHeaders(),
			...options.headers
		}
	});
}
