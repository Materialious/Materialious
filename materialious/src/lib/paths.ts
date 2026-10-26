import { resolve } from '$app/paths';
import { isAndroidTv } from './utils.js';

const resolvePathname = resolve as unknown as (pathname: string) => string;

export function resolvePath(pathname: string): string {
	return resolvePathname(pathname.startsWith('/') ? pathname.slice(1) : pathname);
}

export function resolveWatchPath(videoId: string, playlistId?: string): string {
	const path = isAndroidTv()
		? resolve('/(no-layout)/tv/[slug]', { slug: videoId })
		: resolve('/(app)/watch/[slug]', { slug: videoId });

	return playlistId ? `${path}?playlist=${playlistId}` : path;
}
