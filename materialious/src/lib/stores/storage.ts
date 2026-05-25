import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import {
	createLocalStorage,
	type StorageInterface,
	type SelfUpdateStorageInterface
} from '@macfja/svelte-persistent-store';
import { serialize, deserialize } from '@macfja/serializer';

function createListenerFunctions(): {
	callListeners: (eventKey: string, newValue: any) => void;
	addListener: (key: string, listener: (newValue: any) => void) => void;
	removeListener: (key: string, listener: (newValue: any) => void) => void;
} {
	const listeners: Array<{ key: string; listener: (newValue: any) => void }> = [];
	return {
		callListeners(eventKey: string, newValue: any) {
			if (newValue === undefined) {
				return;
			}
			listeners.filter(({ key }) => key === eventKey).forEach(({ listener }) => listener(newValue));
		},
		addListener(key: string, listener: (newValue: any) => void) {
			listeners.push({ key, listener });
		},
		removeListener(key: string, listener: (newValue: any) => void) {
			const index = listeners.indexOf({ key, listener });
			if (index !== -1) {
				listeners.splice(index, 1);
			}
		}
	};
}

export function createStorage(): StorageInterface<any> | SelfUpdateStorageInterface<any> {
	if (Capacitor.getPlatform() === 'android') {
		const { removeListener, callListeners, addListener } = createListenerFunctions();
		return {
			getValue(key: string): any | null {
				Preferences.get({ key: key }).then((value) => {
					if (value.value !== null) {
						callListeners(key, deserialize(value.value));
					}
				});

				return null;
			},
			deleteValue(key: string) {
				Preferences.remove({ key: key });
			},
			setValue(key: string, value: any) {
				Preferences.set({ key: key, value: serialize(value) });
			},
			addListener,
			removeListener
		};
	} else {
		return createLocalStorage(true);
	}
}

export function ifNotWebDefault(givenValue: any, defaultValue: any): any {
	if (typeof givenValue !== 'undefined' && givenValue !== null) {
		return givenValue;
	} else if (defaultValue && Capacitor.getPlatform() !== 'web') {
		return defaultValue;
	}
}
