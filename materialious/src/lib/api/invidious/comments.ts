import type { Comments, CommentsOptions } from '../model';
import { buildPath, fetchErrorHandle } from './request';

export async function getCommentsInvidious(
	videoId: string,
	options: CommentsOptions,
	fetchOptions?: RequestInit
): Promise<Comments> {
	const path = buildPath(`comments/${videoId}`);
	if (options.continuation) path.searchParams.set('continuation', options.continuation);
	if (options.sort_by) path.searchParams.set('sort_by', options.sort_by);

	const resp = await fetchErrorHandle(await fetch(path, fetchOptions));
	return await resp.json();
}
