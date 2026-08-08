declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			userId: string;
			captchaKey: string;
			captchaSignature: string;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
	interface Window {
		yt?: {
			config_: { [key: string]: unknown };
		};
		electronAPI: {
			generatePoToken: (requestKey: string, visitorData: string) => Promise<string>;
			setAllowInsecureSSL: (allowInsecureSSL: boolean) => Promise<boolean>;
			doUpdateCheck: (disableAutoUpdate: boolean) => Promise<void>;
			getDownloadFormats: (videoId: string) => Promise<{
				title: string;
				formats: {
					itag: number;
					mimeType: string;
					codec: string | null;
					container: string;
					qualityLabel?: string;
					width?: number;
					height?: number;
					bitrate: number;
					hasAudio: boolean;
					hasVideo: boolean;
					hasText: boolean;
				}[];
			}>;
			downloadVideo: (payload: {
				videoId: string;
				selection: {
					type: 'video' | 'audio' | 'video+audio' | 'merged';
					quality?: string;
					format?: string;
					codec?: string;
				};
			}) => Promise<{ canceled?: boolean; path?: string; error?: string }>;
			onDownloadProgress: (
				callback: (videoId: string, progress: number) => void
			) => void;
			removeDownloadProgressListener: () => void;
		};
	}
}

export {};
