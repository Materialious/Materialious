export type SabrFormat = {
	itag: number;
	mimeType: string;
	codec: string | null;
	container: string;
	url?: string;
	qualityLabel?: string;
	width?: number;
	height?: number;
	fps?: number;
	bitrate: number;
	contentLength?: number;
	hasAudio: boolean;
	hasVideo: boolean;
	hasText: boolean;
	audioQuality?: string;
	audioChannels?: number;
	audioSampleRate?: number;
	approxDurationMs?: number;
	projectionType?: string;
	language?: string | null;
};

export type DownloadType = 'video' | 'audio' | 'video+audio' | 'merged';

export type DownloadFormatSelection = {
	type: DownloadType;
	quality?: string;
	itag?: number;
	format?: string;
	codec?: string;
	language?: string;
};

export type MergeContainer = 'mp4' | 'webm' | 'mkv';
