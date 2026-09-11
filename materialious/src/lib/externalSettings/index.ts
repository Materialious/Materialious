import { page } from '$app/state';
import { get } from 'svelte/store';
import { z } from 'zod';

import { persistedStores, ensureBackendPersistedStores, type PersistedStore } from './settings';

import { getPublicEnv } from '$lib/env';
import { isMaterialiousAccountActive } from '$lib/backend';
import { addOrUpdateKeyValue, getKeyValue } from '$lib/api/backend/keyvalue';
import { rawMasterKeyStore } from '$lib/store';

const dontAutoSync = ['authToken'];

export async function syncSettingsToBackend() {
	if (!isMaterialiousAccountActive() || !get(rawMasterKeyStore)) return;

	ensureBackendPersistedStores();

	await Promise.all(
		persistedStores.map(async (store) => {
			if (store.excludeFromBackendSync || dontAutoSync.includes(store.name)) return;

			getKeyValue(store.name)
				.then((currentKeyValue) => {
					if (currentKeyValue !== null) {
						const currentKeyValueParsed = parseWithSchema(store.schema, currentKeyValue);
						if (currentKeyValueParsed !== null && currentKeyValueParsed !== undefined) {
							store.store.set(currentKeyValueParsed);
						}
					}
				})
				.catch(() => {
					// Remote instance unreachable, keep local value.
				});

			let initialLoad = true;
			store.store.subscribe((value) => {
				if (!get(rawMasterKeyStore)) return;

				if (initialLoad) {
					initialLoad = false;
					return;
				}

				if (value === undefined) return;

				return addOrUpdateKeyValue(
					store.name,
					store.serialize ? store.serialize(value) : value?.toString()
				).catch(() => {
					// Remote instance unreachable while syncing.
				});
			});
		})
	);
}

export function parseWithSchema<T>(schema: z.ZodType<T>, raw: unknown): T | undefined {
	try {
		if (typeof raw === 'string') {
			// Try JSON first (records / objects)
			try {
				return schema.parse(JSON.parse(raw));
			} catch {
				return schema.parse(raw);
			}
		}
		return schema.parse(raw);
	} catch {
		return undefined;
	}
}

function setStores(
	toSet: Record<string, unknown>,
	overwriteExisting = false,
	allowedNames?: Set<string>
) {
	if (!overwriteExisting) return;

	const stores = allowedNames
		? persistedStores.filter((s) => allowedNames.has(s.name))
		: persistedStores;

	for (const { name, store, schema } of stores) {
		const raw = toSet[name];
		if (raw === undefined) continue;

		const parsed = parseWithSchema(schema, raw);
		if (parsed !== undefined) {
			store.set(parsed);
		}
	}
}

export async function loadSettingsFromFile(
	file: File,
	storeNames?: string[]
) {
	const fileContents = await file.text();

	let fileJson: Record<any, any> | undefined;
	try {
		fileJson = JSON.parse(fileContents);
	} catch {
		// Handled outside of catch.
	}

	if (!fileJson) return;

	const allowedNames = storeNames ? new Set(storeNames) : undefined;
	setStores(fileJson, true, allowedNames);
}

export function loadSettingsFromEnv() {
	const defaultSettings = getPublicEnv('DEFAULT_SETTINGS');

	if (typeof defaultSettings !== 'string') return;

	let raw = defaultSettings;

	// Docker wraps env vars in quotes
	if (raw.startsWith('"')) raw = raw.slice(1);
	if (raw.endsWith('"')) raw = raw.slice(0, -1);

	let isInitialLoad = false;
	try {
		if (localStorage.getItem('initialLoadState') === null) {
			isInitialLoad = true;
			localStorage.setItem('initialLoadState', '0');
		}
	} catch {
		isInitialLoad = true;
	}

	try {
		const parsed = JSON.parse(raw);
		setStores(parsed, isInitialLoad);
	} catch (err) {
		console.error(err);
	}
}

export function bookmarkletSaveToUrl(stores: PersistedStore<any>[] = persistedStores): string {
	const url = new URL(location.origin);

	for (const { name, store, serialize, excludeFromBookmarklet } of stores) {
		const value = get(store);
		const encoded = serialize ? serialize(value) : value?.toString();

		if (encoded !== undefined && !excludeFromBookmarklet) {
			url.searchParams.set(name, encoded);
		}
	}

	return url.toString();
}

export function settingsToJson(stores: PersistedStore<any>[] = persistedStores): string {
	const settings: Record<string, string> = {};

	for (const { name, store, excludeFromBookmarklet } of stores) {
		const value = get(store);
		if (!excludeFromBookmarklet) {
			settings[name] = value;
		}
	}

	return JSON.stringify(settings);
}

export function bookmarkletLoadFromUrl() {
	const toSet: Record<string, string> = {};

	page.url.searchParams.forEach((value, key) => {
		toSet[key] = value;
	});

	setStores(toSet, true);
}
