export interface PlayerEvent {
	type: 'pause' | 'seek' | 'change-video' | 'play' | 'playlist' | 'goto';
	path?: string;
	time?: number;
	videoId?: string;
	playlistId?: string;
}

export interface PlayerEvents {
	events: PlayerEvent[];
}

export const playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3];
