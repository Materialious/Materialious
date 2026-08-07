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
			setAllowInsecureSSL: (allowInsecureSSL: boolean) => Promoise<boolean>;
			doUpdateCheck: (disableAutoUpdate: boolean) => Promise<void>;
		};
	}
}

export {};
