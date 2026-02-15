import { page } from '$app/state';
import { get } from 'svelte/store';
import { z } from 'zod';

import { env } from '$env/dynamic/public';
import { persistedStores } from './settings';

import { isOwnBackend } from '$lib/shared';
import { addOrUpdateKeyValue, getKeyValue } from '$lib/api/backend';
import { rawMasterKeyStore } from '$lib/store';

export async function syncSettingsToBackend() {
	if (!isOwnBackend() || !get(rawMasterKeyStore)) return;

	await Promise.all(
		persistedStores.map(async (store) => {
			getKeyValue(store.name).then((currentKeyValue) => {
				if (currentKeyValue !== null) {
					const currentKeyValueParsed = parseWithSchema(store.schema, currentKeyValue);
					if (currentKeyValueParsed !== null && currentKeyValueParsed !== undefined) {
						store.store.set(currentKeyValueParsed);
					}
				}
			});

			let initalLoad = true;
			store.store.subscribe((value) => {
				if (!get(rawMasterKeyStore)) return;

				if (initalLoad) {
					initalLoad = false;
					return;
				}

				if (value === undefined) return;

				return addOrUpdateKeyValue(
					store.name,
					store.serialize ? store.serialize(value) : value?.toString()
				);
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

function setStores(toSet: Record<string, unknown>, overwriteExisting = false) {
	if (!overwriteExisting) return;

	for (const { name, store, schema } of persistedStores) {
		const raw = toSet[name];
		if (raw === undefined) continue;

		const parsed = parseWithSchema(schema, raw);
		if (parsed !== undefined) {
			store.set(parsed);
		}
	}
}

export function loadSettingsFromEnv() {
	if (
		typeof import.meta.env.VITE_DEFAULT_SETTINGS !== 'string' &&
		typeof env.PUBLIC_DEFAULT_SETTINGS !== 'string'
	)
		return;

	let raw = import.meta.env.VITE_DEFAULT_SETTINGS || env.PUBLIC_DEFAULT_SETTINGS;

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

export function bookmarkletSaveToUrl(): string {
	const url = new URL(location.origin);

	for (const { name, store, serialize, excludeFromBookmarklet } of persistedStores) {
		const value = get(store);
		const encoded = serialize ? serialize(value) : value?.toString();

		if (encoded !== undefined && !excludeFromBookmarklet) {
			url.searchParams.set(name, encoded);
		}
	}

	return url.toString();
}

export function bookmarkletLoadFromUrl() {
	const toSet: Record<string, string> = {};

	page.url.searchParams.forEach((value, key) => {
		toSet[key] = value;
	});

	setStores(toSet, true);
}
