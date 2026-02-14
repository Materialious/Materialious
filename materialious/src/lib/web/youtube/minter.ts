import type { IGetChallengeResponse } from 'youtubei.js';

export async function webPoTokenMinter(
	requestKey: string,
	visitorData: string,
	challenge: IGetChallengeResponse
): Promise<string> {
	const resp = await fetch('/api/poToken/', {
		body: JSON.stringify({
			requestKey,
			visitorData,
			challenge
		}),
		method: 'POST'
	});

	if (!resp.ok) {
		let errorMsg = 'An error occurred';
		try {
			errorMsg = (await resp.json()).message;
		} catch {
			// Ignore error
		}

		throw new Error(errorMsg);
	}

	return await resp.text();
}
