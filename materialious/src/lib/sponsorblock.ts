import { SponsorBlock } from 'sponsorblock-api';
import { get } from 'svelte/store';
import { sponsorBlockUrlStore, sponsorBlockUserIDStore } from './store';


/**
 * Generates an identifier compatible with SponsorBlock's user-ID format.
 *
 * Based on:
 * https://github.com/ajayyy/maze-utils/blob/6b1ba69c38d967ef60bf21e153492a769e3449fe/src/setup.ts
 */
export function generateSponsorBlockUserID(length = 36): string {
	if (!globalThis.crypto?.getRandomValues) {
		throw new Error('Cryptographically secure randomness is unavailable');
	}

	const charset =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const values = new Uint32Array(length);
	globalThis.crypto.getRandomValues(values);

	return Array.from(values, (value) => charset[value % charset.length]).join('');
}

export function getOrCreateSponsorBlockUserID(forceNew = false) {
	let userID = get(sponsorBlockUserIDStore)?.trim();

	if (!userID || forceNew) {
		userID = generateSponsorBlockUserID();
		sponsorBlockUserIDStore.set(userID);
	}

	return userID;
}

export function createSponsorBlockClient(
	userID = getOrCreateSponsorBlockUserID()
): SponsorBlock {
	const baseURL = get(sponsorBlockUrlStore)?.trim();

	if (!baseURL) {
		throw new Error('SponsorBlock URL is not configured');
	}

	return new SponsorBlock(userID, {
		baseURL,
		userAgent: 'Materialious'
	});
}

export async function getSponsorBlockUsername(
	client?: SponsorBlock
): Promise<string> {
	const sponsorBlock = client ?? createSponsorBlockClient();

	return (await sponsorBlock.getUsername()).trim();
}

/**
 * Workaround for the broken `SponsorBlock#setUsername()` implementation
 * in the `sponsorblock-api` package.
 *
 * The package currently performs `GET /api/setUsername`, but SponsorBlock
 * expects `POST /api/setUsername`.
 */
export async function setSponsorBlockUsername(
	username: string,
	userID = getOrCreateSponsorBlockUserID()
): Promise<string> {
	const trimmedUsername = username.trim();

	if (!trimmedUsername) {
		throw new Error('SponsorBlock username cannot be empty');
	}

	const configuredBaseURL = get(sponsorBlockUrlStore)?.trim();

	if (!configuredBaseURL) {
		throw new Error('SponsorBlock URL is not configured');
	}

	const baseURL = configuredBaseURL.endsWith('/')
		? configuredBaseURL
		: `${configuredBaseURL}/`;

	const url = new URL('api/setUsername', baseURL);

	url.searchParams.set('userID', userID);
	url.searchParams.set('username', trimmedUsername);

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Accept: '*/*',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({})
	});

	if (!response.ok) {
		const message = (await response.text()).trim();

		throw new Error(
			message ||
				`SponsorBlock username update failed with status ${response.status}`
		);
	}

	return trimmedUsername;
}
