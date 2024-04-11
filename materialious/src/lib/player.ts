export interface PlayerEvent {
	type: 'pause' | 'seek' | 'change-video' | 'play' | 'playlist';
	time?: number;
	videoId?: string;
	playlistId?: string;
}

export interface PlayerEvents {
	events: PlayerEvent[];
}
