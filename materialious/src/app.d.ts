// See https://kit.svelte.dev/docs/types#app

// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
	interface Window {
		electronAPI: {
			generatePoToken: (requestKey: string, visitorData: string) => Promise<string>;
			setAllowInsecureSSL: (allowInsecureSSL: boolean) => Promoise<boolean>;
			doUpdateCheck: (disableAutoUpdate: boolean) => Promise<void>;
		};
	}
}

export {};
