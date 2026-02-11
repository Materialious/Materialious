import { getInnertube } from '.';
import type { SearchOptions, SearchResults } from '../model';
import { type Types, YT } from 'youtubei.js';
import { invidiousItemSchema } from './schema';

function invidiousSchema(innerResults: YT.Search): SearchResults {
	const searchResults: SearchResults = [];

	innerResults.results.forEach((result) => {
		const item = invidiousItemSchema(result);
		if (item) searchResults.push(item);
	});

	return searchResults;
}

function setGetContinuation(innerResults: YT.Search) {
	return async () => {
		const result = await innerResults.getContinuation();
		const searchResults = invidiousSchema(result);
		searchResults.getContinuation = setGetContinuation(result);
		return searchResults;
	};
}

export async function getSearchYTjs(
	search: string,
	options: SearchOptions
): Promise<SearchResults> {
	const innertube = await getInnertube();

	const innerResults = await innertube.search(search, {
		sort_by: options.sort_by,
		duration: options.duration,
		features: [options.features] as Types.Feature[],
		upload_date: options.date
	});

	const searchResults = invidiousSchema(innerResults);
	searchResults.getContinuation = setGetContinuation(innerResults);

	return searchResults;
}
