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

	let duration: Types.Duration = 'all';

	switch (options.duration) {
		case 'long':
			duration = 'over_twenty_mins';
			break;
		case 'medium':
			duration = 'three_to_twenty_mins';
			break;
		case 'short':
			duration = 'under_three_mins';
			break;
	}

	const innerResults = await innertube.search(search, {
		prioritize: options.sort_by !== 'relevance' ? 'popularity' : 'relevance',
		duration: duration,
		features: [options.features] as Types.Feature[],
		upload_date: options.date
	});

	return fetchSearchWithContinuation(innerResults);
}
