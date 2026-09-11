import { get } from 'svelte/store';
import { Capacitor } from '@capacitor/core';
import { isOwnBackend } from './shared';
import {
	authTokenStore,
	backendInUseStore,
	materialiousBackendStore,
	rawMasterKeyStore
} from './store';
import { ensureNoTrailingSlash } from './utils';

export function isUnrestrictedPlatform(): boolean {
	return isOwnBackend() !== null || Capacitor.isNativePlatform();
}

export function getMaterialiousBackendUrl(): string {
	const remote = get(materialiousBackendStore);
	if (remote) return ensureNoTrailingSlash(remote);
	return '';
}

export function getMaterialiousAuthHeaders(): HeadersInit {
	const token = get(authTokenStore);
	return token !== undefined ? { Authorization: `Bearer ${token}` } : {};
}

export function isMaterialiousAccountActive(): boolean {
	if (!get(rawMasterKeyStore)) return false;
	return !!isOwnBackend()?.internalAuth;
}

export function remoteMaterialiousSupported(): boolean {
	return Capacitor.getPlatform() === 'electron' || Capacitor.getPlatform() === 'android';
}

export function isYTBackend(): boolean {
	return get(backendInUseStore) === 'yt' && isUnrestrictedPlatform();
}