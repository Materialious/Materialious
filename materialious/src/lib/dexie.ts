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

export interface ChannelAvatars {
	channelId: string;
	avatarUrl: string;
	updated: Date;
}

export class MaterialiousDb extends Dexie {
	favouriteChannels!: Table<FavouriteChannels>;
	channelSubscriptions!: Table<ChannelSubscriptions>;
	subscriptionFeed!: Table<Video>;
	watchHistory!: Table<VideoWatchHistory>;
	channelAvatars!: Table<ChannelAvatars>;

	constructor() {
		super('materialious');
		this.version(4).stores({
			favouriteChannels: 'channelId',
			channelSubscriptions: 'channelId',
			subscriptionFeed: 'videoId, authorId, published',
			watchHistory: 'videoId',
			channelAvatars: 'channelId'
		});
	}
}

export const localDb = new MaterialiousDb();
