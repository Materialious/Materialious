import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { get } from 'svelte/store';
import {
	authTokenStore,
	invidiousAuthStore,
	channelCacheStore,
	feedCacheStore,
	invidiousInstanceStore,
	materialiousBackendStore,
	playlistCacheStore,
	rawMasterKeyStore,
	searchCacheStore
} from './store';
import { Capacitor } from '@capacitor/core';
import { isOwnBackend } from './shared';
import { Browser } from '@capacitor/browser';
import { clearFeedYTjs } from './api/youtubejs/subscriptions';
import { ensureNoTrailingSlash } from './utils';
import { isYTBackend } from './backend';
import { deleteKeyValue } from './api/backend/keyvalue';
import semver from 'semver';
import { backendFetch } from './api/backend/request';

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

	const instance = ensureNoTrailingSlash(instanceUrl).toLowerCase();

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
		backendFetch('/api/user/logout', { method: 'DELETE' }).catch(() => {
			// Remote instance unreachable.
		});
		authTokenStore.set(undefined);
		rawMasterKeyStore.set(undefined);
		clearCaches();
	}

	goto(resolve('/', {}));
}

export async function setMaterialiousBackend(
	instanceUrl: string | undefined | null
): Promise<boolean> {
	if (typeof instanceUrl !== 'string') {
		return false;
	}

	let invalid = false;

	const backend = ensureNoTrailingSlash(instanceUrl).toLowerCase();

	try {
		new URL(backend);
	} catch {
		invalid = true;
	}

	if (invalid) return false;

	let resp;
	try {
		resp = await fetch(`${backend}/api/config`);
	} catch {
		invalid = true;
	}

	if (invalid) return false;

	if (resp && !resp.ok) {
		return false;
	}

	try {
		const config = await resp?.json();
		if (config?.backend !== 'materialious' || !config?.internalAuth) {
			return false;
		}
		if (!config?.version || !semver.gte(config.version, '1.17.15')) {
			return false;
		}
	} catch {
		return false;
	}

	materialiousBackendStore.set(backend);
	await removeAuthFromBackend();
	authTokenStore.set(undefined);
	rawMasterKeyStore.set(undefined);

	return true;
}
