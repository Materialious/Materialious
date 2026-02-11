import type { SearchOptions } from './model';

export function searchSetDefaults(options: SearchOptions) {
	if (typeof options.sort_by === 'undefined') {
		options.sort_by = 'relevance';
	}

	if (typeof options.type === 'undefined') {
		options.type = 'all';
	}

	if (typeof options.page === 'undefined') {
		options.page = '1';
	}
}
