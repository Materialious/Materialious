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

async function fetchSearchWithContinuation(innerResults: YT.Search): Promise<SearchResults> {
	const searchResults = invidiousSchema(innerResults);

	if (innerResults.has_continuation) {
		searchResults.getContinuation = async () => {
			const continuation = await innerResults.getContinuation();
			return fetchSearchWithContinuation(continuation);
		};
	}

	return searchResults;
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

	return fetchSearchWithContinuation(innerResults);
}
