import type { Video } from '../model';
import { buildPath, fetchErrorHandle } from './request';

export async function getHashtagInvidious(
	tag: string,
	page: number = 0
): Promise<{ results: Video[] }> {
	const path = buildPath(`hashtag/${tag}`);
	path.searchParams.set('page', page.toString());

	const resp = await fetchErrorHandle(await fetch(path));
	return await resp.json();
}
