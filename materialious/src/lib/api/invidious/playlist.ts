import { get } from 'svelte/store';
import type { PlaylistPage } from '../model';
import { buildAuthHeaders, buildPath, fetchErrorHandle } from './request';
import { invidiousAuthStore } from '$lib/store';

export async function getPlaylistInvidious(
	playlistId: string,
	page: number = 1,
	fetchOptions: RequestInit = {}
): Promise<PlaylistPage> {
	let resp;

	const path = buildPath(`${get(invidiousAuthStore) ? 'auth/' : ''}playlists/${playlistId}`);
	path.searchParams.set('page', page.toString());

	if (get(invidiousAuthStore)) {
		resp = await fetch(path, {
			...buildAuthHeaders(),
			...fetchOptions
		});
	} else {
		resp = await fetch(path, fetchOptions);
	}
	await fetchErrorHandle(resp);
	return await resp.json();
}

export async function getPersonalPlaylistsInvidious(
	fetchOptions: RequestInit = {}
): Promise<PlaylistPage[]> {
	const resp = await fetchErrorHandle(
		await fetch(buildPath('auth/playlists'), { ...buildAuthHeaders(), ...fetchOptions })
	);
	return await resp.json();
}

export async function deletePersonalPlaylistInvidious(playlistId: string) {
	await fetchErrorHandle(
		await fetch(buildPath(`auth/playlists/${playlistId}`), {
			method: 'DELETE',
			...buildAuthHeaders()
		})
	);
}

export async function postPersonalPlaylistInvidious(
	title: string,
	privacy: 'public' | 'private' | 'unlisted',
	fetchOptions: RequestInit = {}
) {
	const headers: Record<string, Record<string, string>> = buildAuthHeaders();
	headers['headers']['Content-type'] = 'application/json';

	await fetchErrorHandle(
		await fetch(buildPath('auth/playlists'), {
			method: 'POST',
			body: JSON.stringify({
				title: title,
				privacy: privacy
			}),
			...headers,
			...fetchOptions
		})
	);
}

export async function addPlaylistVideoInvidious(
	playlistId: string,
	videoId: string,
	fetchOptions: RequestInit = {}
) {
	const headers: Record<string, Record<string, string>> = buildAuthHeaders();
	headers['headers']['Content-type'] = 'application/json';

	await fetchErrorHandle(
		await fetch(buildPath(`auth/playlists/${playlistId}/videos`), {
			method: 'POST',
			body: JSON.stringify({
				videoId: videoId
			}),
			...headers,
			...fetchOptions
		})
	);
}

export async function removePlaylistVideoInvidious(
	playlistId: string,
	indexId: string,
	fetchOptions: RequestInit = {}
) {
	await fetchErrorHandle(
		await fetch(buildPath(`auth/playlists/${playlistId}/videos/${indexId}`), {
			method: 'DELETE',
			...buildAuthHeaders(),
			...fetchOptions
		})
	);
}
