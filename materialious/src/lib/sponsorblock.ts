import { SponsorBlock } from 'sponsorblock-api';
import { get } from 'svelte/store';
import { sponsorBlockUrlStore, sponsorBlockUserIDStore, sponsorBlockUsernameStore } from './store';

export function generateSponsorBlockUUID64() {
	return crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
}

export function getOrCreateSponsorBlockUserID(forceNew = false) {
	let userID = get(sponsorBlockUserIDStore)?.trim();

	if (!userID || forceNew) {
		userID = generateSponsorBlockUUID64();
		sponsorBlockUserIDStore.set(userID);
	}

	return userID;
}

export function getOrCreateSponsorBlockUsername(forceNew = false) {
	let username = get(sponsorBlockUsernameStore)?.trim();

	if (!username || forceNew) {
		username = generateSponsorBlockUUID64();
		sponsorBlockUsernameStore.set(username);
	}

	return username;
}

export function ensureSponsorBlockIdentity() {
	return {
		userID: getOrCreateSponsorBlockUserID(),
		username: getOrCreateSponsorBlockUsername()
	};
}

export function createSponsorBlockClient() {
	const userID = getOrCreateSponsorBlockUserID();
	const baseURL = get(sponsorBlockUrlStore);

	if (!baseURL) {
		throw new Error('SponsorBlock URL is not configured');
	}

	return new SponsorBlock(userID, {
		baseURL,
		userAgent: 'Materialious'
	});
}

/**
 * Workaround for the broken `SponsorBlock#setUsername()` implementation
 * in the `sponsorblock-api` package.
 *
 * The package currently performs `GET /api/setUsername`, but SponsorBlock
 * expects `POST /api/setUsername`.
 */
export async function setSponsorBlockUsername(username: string) {
	const trimmedUsername = username.trim();

	if (!trimmedUsername) return;

	const userID = getOrCreateSponsorBlockUserID();

	const baseURL = get(sponsorBlockUrlStore)?.trim();

	if (!baseURL) {
		throw new Error('SponsorBlock URL is not configured');
	}

	const url = new URL('/api/setUsername', baseURL);

	url.searchParams.set('userID', userID);
	url.searchParams.set('username', trimmedUsername);

	const response = await fetch(url, {
		method: 'POST'
	});

	if (!response.ok) {
		throw new Error(await response.text());
	}
}
