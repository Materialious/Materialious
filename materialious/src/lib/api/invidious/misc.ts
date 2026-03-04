import type { ResolvedUrl } from '../model';
import { buildPath, fetchErrorHandle } from './request';

export async function getResolveUrlInvidious(url: string): Promise<ResolvedUrl> {
	const path = buildPath('resolveurl');
	path.searchParams.set('url', url);

	const resp = await fetchErrorHandle(await fetch(path));
	return await resp.json();
}
