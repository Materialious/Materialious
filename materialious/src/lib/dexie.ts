import type { Table } from 'dexie';
import Dexie from 'dexie';

export interface FavouriteChannels {
	channelId: string;
	created: Date;
}

export class MaterialiousDb extends Dexie {
	favouriteChannels!: Table<FavouriteChannels>;

	constructor() {
		super('materialious');
		this.version(1).stores({
			favouriteChannels: 'channelId, created'
		});
	}
}

export const localDb = new MaterialiousDb();
