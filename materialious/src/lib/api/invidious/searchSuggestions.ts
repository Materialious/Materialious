import type { SearchSuggestion } from '../model';
import { buildPath, fetchErrorHandle } from './request';

export async function getSearchSuggestionsInvidious(
	search: string,
	fetchOptions?: RequestInit
): Promise<SearchSuggestion> {
	const path = buildPath('search/suggestions');
	path.searchParams.set('q', search);

	const resp = await fetchErrorHandle(await fetch(path, fetchOptions));
	return await resp.json();
}
