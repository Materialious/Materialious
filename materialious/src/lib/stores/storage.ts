import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import {
	createLocalStorage,
	type StorageInterface,
	type SelfUpdateStorageInterface
} from '@macfja/svelte-persistent-store';
import { serialize, deserialize } from '@macfja/serializer';

type StorageListener = (newValue: any) => void;

type HydratableStorage = SelfUpdateStorageInterface<any> & {
	hydrate: (timeoutMs?: number) => Promise<void>;
};

const HYDRATION_TIMEOUT_MS = 2000;
const INITIAL_LOAD_STATE_KEY = 'initialLoadState';

function createAndroidStorage(): HydratableStorage {
	const listeners = new Map<string, Set<StorageListener>>();
	const hydratedKeys = new Set<string>();
	const hydratedValues = new Map<string, any>();
	const inFlight = new Map<string, Promise<void>>();

	function callListeners(key: string, newValue: any) {
		if (newValue === undefined) return;
		listeners.get(key)?.forEach((listener) => listener(newValue));
	}

	function read(key: string): Promise<void> {
		if (hydratedKeys.has(key)) return Promise.resolve();

		const existing = inFlight.get(key);
		if (existing) return existing;

		const promise = Preferences.get({ key })
			.then(({ value }) => {
				if (value === null) return;

				const parsed = deserialize(value);
				if (parsed === undefined) return;

				hydratedValues.set(key, parsed);
				// Mark the key as hydrated before notifying listeners so the
				// store's write-back (triggered by the listener) is persisted.
				hydratedKeys.add(key);
				callListeners(key, parsed);
			})
			.catch((error) => {
				console.error(`Failed to load preference "${key}"`, error);
			})
			.finally(() => {
				hydratedKeys.add(key);
				inFlight.delete(key);
			});

		inFlight.set(key, promise);
		return promise;
	}

	return {
		getValue(key: string): any | null {
			// Start the async read now, but return null so the persisted store
			// keeps its default until the read completes and notifies its listener.
			void read(key);
			return null;
		},
		setValue(key: string, value: any) {
			// Never write before the initial read completes. Otherwise a store's
			// default value can overwrite the user's saved value if the app is
			// killed during startup (see issue #2016).
			if (!hydratedKeys.has(key)) return;

			void Preferences.set({ key, value: serialize(value) }).catch((error) => {
				console.error(`Failed to save preference "${key}"`, error);
			});
		},
		deleteValue(key: string) {
			if (!hydratedKeys.has(key)) return;

			void Preferences.remove({ key }).catch((error) => {
				console.error(`Failed to remove preference "${key}"`, error);
			});
		},
		addListener(key: string, listener: StorageListener) {
			let keyListeners = listeners.get(key);
			if (!keyListeners) {
				keyListeners = new Set();
				listeners.set(key, keyListeners);
			}
			keyListeners.add(listener);

			// The read may have completed before the listener was registered.
			if (hydratedValues.has(key)) {
				const value = hydratedValues.get(key);
				queueMicrotask(() => listener(value));
			}
		},
		removeListener(key: string, listener: StorageListener) {
			listeners.get(key)?.delete(listener);
		},
		async hydrate(timeoutMs = HYDRATION_TIMEOUT_MS) {
			const deadline = Date.now() + timeoutMs;

			while (inFlight.size > 0) {
				const remaining = deadline - Date.now();
				if (remaining <= 0) {
					console.warn('Timed out waiting for Android preferences to load');
					break;
				}

				await new Promise<void>((resolve) => {
					let settled = false;
					const finish = () => {
						if (settled) return;
						settled = true;
						clearTimeout(timer);
						resolve();
					};

					const timer = setTimeout(finish, remaining);
					Promise.allSettled([...inFlight.values()]).then(finish);
				});
			}
		}
	};
}

let androidStorage: HydratableStorage | undefined;

export function createStorage(): StorageInterface<any> | SelfUpdateStorageInterface<any> {
	if (Capacitor.getPlatform() === 'android') {
		androidStorage ??= createAndroidStorage();
		return androidStorage;
	}

	return createLocalStorage(true);
}

/**
 * Wait for every persisted store's initial read to finish.
 *
 * Android's Preferences API is asynchronous, so routing decisions (setup,
 * login, default page) must not run against store defaults.
 */
export async function hydrateSettings(timeoutMs?: number): Promise<void> {
	if (Capacitor.getPlatform() !== 'android' || !androidStorage) return;

	await androidStorage.hydrate(timeoutMs);
}

/**
 * Returns true the first time it is called on this device and records that
 * the instance defaults have been applied.
 *
 * Uses Preferences on Android so a cleared WebView localStorage cannot
 * re-apply DEFAULT_SETTINGS and wipe the user's settings.
 */
export async function consumeInitialLoadState(): Promise<boolean> {
	if (Capacitor.getPlatform() === 'android') {
		try {
			const { value } = await Preferences.get({ key: INITIAL_LOAD_STATE_KEY });
			if (value !== null) return false;

			// Migrate the legacy localStorage flag so upgrading users don't
			// re-apply instance defaults over their existing settings.
			let legacyFlag: string | null = null;
			try {
				legacyFlag = localStorage.getItem(INITIAL_LOAD_STATE_KEY);
			} catch {
				// Ignore unavailable localStorage.
			}

			// The WebView's localStorage may already have been cleared by the
			// time this migration runs. Existing preferences are still proof
			// that this is not a fresh install, so treat them as such.
			let hasExistingSettings = false;
			try {
				const { keys } = await Preferences.keys();
				hasExistingSettings = keys.some((key) => key !== INITIAL_LOAD_STATE_KEY);
			} catch {
				// Ignore if the plugin cannot enumerate keys.
			}

			await Preferences.set({ key: INITIAL_LOAD_STATE_KEY, value: '0' });
			return legacyFlag === null && !hasExistingSettings;
		} catch {
			return true;
		}
	}

	try {
		if (localStorage.getItem(INITIAL_LOAD_STATE_KEY) === null) {
			localStorage.setItem(INITIAL_LOAD_STATE_KEY, '0');
			return true;
		}
	} catch {
		return true;
	}

	return false;
}

export function ifNotWebDefault(givenValue: any, defaultValue: any): any {
	if (typeof givenValue !== 'undefined' && givenValue !== null) {
		return givenValue;
	} else if (defaultValue && Capacitor.getPlatform() !== 'web') {
		return defaultValue;
	}
}
