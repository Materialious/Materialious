import { getInnertube } from '.';
import type { SearchSuggestion } from '../model';

export async function getSearchSuggestionsYTjs(search: string): Promise<SearchSuggestion> {
	const innertube = await getInnertube();

	const searchSuggestions = await innertube.getSearchSuggestions(search);

	return {
		query: search,
		suggestions: searchSuggestions
	};
}
