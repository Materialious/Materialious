// See https://kit.svelte.dev/docs/types#app

import type { IGetChallengeResponse } from "youtubei.js";

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
			generatePoToken: (
				challengeResponse: IGetChallengeResponse,
				requestKey: string,
				visitorData: string,
				videoId: string
			) => Promise<[string, string]>;
		};
	}
}

export { };

