import type { IGetChallengeResponse } from 'youtubei.js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			userId: string;
			captchaKey: string;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
	interface Window {
		electronAPI: {
			generatePoToken: (
				requestKey: string,
				visitorData: string,
				challenge: IGetChallengeResponse
			) => Promise<string>;
			setAllowInsecureSSL: (allowInsecureSSL: boolean) => Promoise<boolean>;
			doUpdateCheck: (disableAutoUpdate: boolean) => Promise<void>;
		};
	}
}

export {};
