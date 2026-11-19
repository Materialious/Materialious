import { getBestThumbnail } from '#lib/images';
import type { PlaylistPage, PlaylistPageVideo } from '../model';
import { decryptWithMasterKey, encryptWithMasterKey } from './encryption';
import { backendFetch } from './request';

const prefix = 'materialious-';
const endpoint = '/api/user/playlists';
export const isMaterialiousPlaylist = (id: string) => id.startsWith(prefix);

interface EncryptedPlaylist {
	owner: { username: string };
	id: string;
	titleCipher: string;
	titleNonce: string;
	videos?: EncryptedVideo[];
	updatedAt: string;
}

interface EncryptedVideo {
	id: string;
	videoIdCipher: string;
	videoIdNonce: string;
	titleCipher: string;
	titleNonce: string;
	authorCipher: string;
	authorNonce: string;
	authorIdCipher: string;
	authorIdNonce: string;
	thumbnailCipher: string;
	thumbnailNonce: string;
	lengthSeconds: number;
	viewCount: number | string;
	position: number;
}

async function checked(response: Response): Promise<Response> {
	if (!response.ok) throw new Error(`Playlist request failed (${response.status})`);
	return response;
}

async function decrypt(row: EncryptedPlaylist): Promise<PlaylistPage> {
	const text = await decryptField(row.titleNonce, row.titleCipher);
	const title = text;
	const videos = await Promise.all(
		(row.videos ?? []).map(async (video, index) => {
			const [videoId, title, author, authorId, thumbnail] = await Promise.all([
				decryptField(video.videoIdNonce, video.videoIdCipher),
				decryptField(video.titleNonce, video.titleCipher),
				decryptField(video.authorNonce, video.authorCipher),
				decryptField(video.authorIdNonce, video.authorIdCipher),
				decryptField(video.thumbnailNonce, video.thumbnailCipher)
			]);
			return {
				type: 'video',
				videoId,
				title,
				author,
				authorId,
				videoThumbnails: [{ url: thumbnail, width: 0, height: 0 }],
				lengthSeconds: video.lengthSeconds,
				viewCount: Number(video.viewCount),
				indexId: video.id,
				index
			} satisfies PlaylistPageVideo;
		})
	);
	return {
		title,
		videos,
		updated: new Date(row.updatedAt).getTime() / 1000,
		type: 'playlist',
		playlistId: prefix + row.id,
		playlistThumbnail: videos[0]?.videoThumbnails[0]?.url ?? '',
		author: row.owner.username,
		authorId: '',
		authorVerified: false,
		videoCount: videos.length,
		description: '',
		descriptionHtml: '',
		viewCount: 0,
		isListed: false
	};
}

async function encrypt(text: string) {
	const encrypted = await encryptWithMasterKey(text);
	if (!encrypted) throw new Error('Unlock your Materialious account to save playlists');
	return encrypted;
}

async function decryptField(nonce: string, cipher: string): Promise<string> {
	const value = await decryptWithMasterKey(nonce, cipher);
	if (value === undefined) throw new Error('Unlock your Materialious account to access playlists');
	return value;
}

function path(id: string) {
	if (!isMaterialiousPlaylist(id)) throw new Error('Invalid Materialious playlist');
	return `${endpoint}/${encodeURIComponent(id.slice(prefix.length))}`;
}

export async function getPersonalPlaylistsBackend(
	options: RequestInit = {}
): Promise<PlaylistPage[]> {
	const response = await checked(await backendFetch(endpoint, options));
	return Promise.all(((await response.json()) as EncryptedPlaylist[]).map(decrypt));
}

export async function getPlaylistBackend(
	id: string,
	page = 1,
	options: RequestInit = {}
): Promise<PlaylistPage> {
	const response = await checked(await backendFetch(path(id), options));
	const playlist = await decrypt(await response.json());
	return { ...playlist, videos: playlist.videos.slice((page - 1) * 100, page * 100) };
}

export async function postPersonalPlaylistBackend(title: string, options: RequestInit = {}) {
	const titleField = await encrypt(title);
	const response = await checked(
		await backendFetch(endpoint, {
			...options,
			method: 'POST',
			body: JSON.stringify({ titleCipher: titleField.cipher, titleNonce: titleField.nonce })
		})
	);
	const created = await response.json();
	if (typeof created.id !== 'string' || !created.id)
		throw new Error('Playlist creation returned no ID');
	return prefix + created.id;
}

export async function deletePersonalPlaylistBackend(id: string) {
	await checked(await backendFetch(path(id), { method: 'DELETE' }));
}

export async function addPlaylistVideoBackend(
	id: string,
	video: Omit<PlaylistPageVideo, 'index' | 'indexId'>,
	options: RequestInit = {}
) {
	const [videoId, title, author, authorId, thumbnail] = await Promise.all([
		encrypt(video.videoId),
		encrypt(video.title),
		encrypt(video.author),
		encrypt(video.authorId),
		encrypt(getBestThumbnail(video.videoThumbnails))
	]);
	await checked(
		await backendFetch(`${path(id)}/videos`, {
			...options,
			method: 'POST',
			body: JSON.stringify({
				videoIdCipher: videoId.cipher,
				videoIdNonce: videoId.nonce,
				titleCipher: title.cipher,
				titleNonce: title.nonce,
				authorCipher: author.cipher,
				authorNonce: author.nonce,
				authorIdCipher: authorId.cipher,
				authorIdNonce: authorId.nonce,
				thumbnailCipher: thumbnail.cipher,
				thumbnailNonce: thumbnail.nonce,
				lengthSeconds: video.lengthSeconds,
				viewCount: video.viewCount ?? 0
			})
		})
	);
}

export async function removePlaylistVideoBackend(
	id: string,
	indexId: string,
	options: RequestInit = {}
) {
	await checked(
		await backendFetch(`${path(id)}/videos/${encodeURIComponent(indexId)}`, {
			...options,
			method: 'DELETE'
		})
	);
}
