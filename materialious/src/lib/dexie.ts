import type { Table } from 'dexie';
import Dexie from 'dexie';
import type { Video, VideoWatchHistory } from './api/model';

export interface FavouriteChannels {
	channelId: string;
	created: Date;
}

export interface ChannelSubscriptions {
	channelId: string;
	channelName: string;
	lastRSSFetch: Date;
}

export class MaterialiousDb extends Dexie {
	favouriteChannels!: Table<FavouriteChannels>;
	channelSubscriptions!: Table<ChannelSubscriptions>;
	subscriptionFeed!: Table<Video>;
	watchHistory!: Table<VideoWatchHistory>;

	constructor() {
		super('materialious');
		this.version(2).stores({
			favouriteChannels: 'channelId',
			channelSubscriptions: 'channelId',
			subscriptionFeed: 'videoId, authorId, published',
			watchHistory: 'videoId, id'
		});
	}
}

export const localDb = new MaterialiousDb();
