import type { SearchOptions, SearchResults } from '../model';
import { buildPath, fetchErrorHandle } from './request';

export async function getSearchInvidious(
	search: string,
	options: SearchOptions,
	fetchOptions?: RequestInit
): Promise<SearchResults> {
	const path = buildPath('search');
	path.searchParams.set('q', search);

	if (options.date) path.searchParams.set('date', options.date);
	if (options.duration) path.searchParams.set('duration', options.duration);
	if (options.features) path.searchParams.set('features', options.features);
	if (options.page) path.searchParams.set('page', options.page);
	if (options.sort_by) path.searchParams.set('sort_by', options.sort_by);
	if (options.type) path.searchParams.set('type', options.type);

	const resp = await fetchErrorHandle(await fetch(path, fetchOptions));
	return await resp.json();
}
