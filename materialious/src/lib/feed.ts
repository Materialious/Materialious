import type {
	Channel,
	HashTag,
	Playlist,
	PlaylistPage,
	PlaylistPageVideo,
	Video,
	VideoBase,
	VideoWatchHistory
} from './api/model';

export type FeedItem =
	| VideoBase
	| Video
	| PlaylistPageVideo
	| Channel
	| Playlist
	| HashTag
	| PlaylistPage
	| VideoWatchHistory;
export type FeedItems = FeedItem[];

export function extractUniqueId(item: FeedItem): string {
	if ('videoId' in item) {
		return item.videoId;
	} else if ('playlistId' in item) {
		return item.playlistId;
	} else if ('authorId' in item) {
		return item.authorId;
	} else {
		return item.title;
	}
}

export function excludeDuplicateFeeds(currentItems: FeedItems, newItems: FeedItems): FeedItems {
	const existingIds: string[] = [];

	currentItems.forEach((item) => {
		existingIds.push(extractUniqueId(item));
	});

	const nonDuplicatedNewItems: FeedItems = [];
	newItems.forEach((item) => {
		if (!existingIds.includes(extractUniqueId(item))) {
			nonDuplicatedNewItems.push(item);
		}
	});

	return [...nonDuplicatedNewItems, ...currentItems];
}
