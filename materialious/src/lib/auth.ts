import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { get } from 'svelte/store';
import {
	invidiousAuthStore,
	channelCacheStore,
	feedCacheStore,
	invidiousInstanceStore,
	playlistCacheStore,
	rawMasterKeyStore,
	searchCacheStore
} from './store';
import { Capacitor } from '@capacitor/core';
import { isOwnBackend } from './shared';
import { Browser } from '@capacitor/browser';
import { clearFeedYTjs } from './api/youtubejs/subscriptions';
import { ensureNoTrailingSlash, isYTBackend } from './misc';
import { deleteKeyValue } from './api/backend/keyvalue';

export function clearCaches() {
	feedCacheStore.set({});
	searchCacheStore.set({});
	playlistCacheStore.set({});
	channelCacheStore.set({});
}

export function authProtected() {
	if (!get(invidiousAuthStore) && !isYTBackend()) {
		goto(resolve('/', {}), { replaceState: true });
	}
}

async function removeAuthFromBackend() {
	if (!get(rawMasterKeyStore)) return;

	await deleteKeyValue('authToken');
}

export async function setInvidiousInstance(
	instanceUrl: string | undefined | null
): Promise<boolean> {
	if (typeof instanceUrl !== 'string') {
		return false;
	}

	let invalidInstance = false;

	const instance = ensureNoTrailingSlash(instanceUrl);

	try {
		new URL(instance);
	} catch {
		invalidInstance = true;
	}

	if (invalidInstance) return false;

	let resp;
	try {
		resp = await fetch(`${instance}/api/v1/channels/UCH-_hzb2ILSCo9ftVSnrCIQ`);
	} catch {
		invalidInstance = true;
	}

	if (invalidInstance) return false;

	if (resp && !resp.ok) {
		return false;
	}

	invidiousInstanceStore.set(instance);
	invidiousAuthStore.set(null);

	await removeAuthFromBackend();

	return true;
}

export async function goToInvidiousLogin() {
	if (!get(invidiousInstanceStore)) return;
	const path = new URL(`${get(invidiousInstanceStore)}/authorize_token`);
	const searchParams = new URLSearchParams({
		scopes: ':feed,:subscriptions*,:playlists*,:history*,:notifications*'
	});
	if (Capacitor.getPlatform() === 'android') {
		searchParams.set('callback_url', 'materialious-auth://');
		path.search = searchParams.toString();
		await Browser.open({ url: path.toString() });
	} else {
		searchParams.set('callback_url', `${location.origin}${resolve('/invidious/auth', {})}`);
		path.search = searchParams.toString();
		document.location.href = path.toString();
	}
}

export async function invidiousLogout() {
	invidiousAuthStore.set(null);
	await removeAuthFromBackend();

	goto(resolve('/', {}));
}

export async function materialiousLogout() {
	if (isYTBackend()) {
		await clearFeedYTjs();
	}

	if (isOwnBackend()?.internalAuth) {
		fetch('/api/user/logout', { method: 'DELETE' });
		rawMasterKeyStore.set(undefined);
	}

	goto(resolve('/', {}));
}
