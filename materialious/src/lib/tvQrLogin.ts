import { NodeJS } from 'capacitor-nodejs';
import type { PluginListenerHandle } from '@capacitor/core';
import sodium from 'libsodium-wrappers-sumo';
import { get } from 'svelte/store';
import { getDynamicTheme } from '#lib/theme/index';
import { darkModeStore } from '#lib/store';

// TV QR login: the WebView drives the session (code + secret), the embedded
// Node process serves the handshake pages to the phone/PC (see
// static/nodejsAndroid/login-server.js).

export const TV_LOGIN_PORT = 3001;
export const TV_LOGIN_TTL_SECONDS = 10 * 60;

// Unambiguous alphabet: no 0/O/1/I. 32 chars so random byte % length has no bias.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export interface TvLoginSession {
	code: string;
	secret: string;
	instance: string;
	// Live app theme + translated strings for the pages the phone/PC sees.
	theme: { vars: Record<string, string>; dark: boolean };
	strings: Record<string, string>;
	lang: string;
}

const THEME_VARS = [
	'primary',
	'on-primary',
	'primary-container',
	'on-primary-container',
	'surface',
	'surface-container',
	'surface-container-highest',
	'on-surface',
	'on-surface-variant',
	'outline',
	'outline-variant',
	'error',
	'on-error'
];

const WEB_STRING_KEYS = [
	'title',
	'instruction',
	'codeLabel',
	'continue',
	'wrongCode',
	'tooManyAttempts',
	'doneTitle',
	'doneBody',
	'expiredTitle',
	'expiredBody',
	'invalidTitle',
	'invalidBody'
];

// Live app theme via the existing helper; the Node side validates every value again.
export async function readTheme(): Promise<TvLoginSession['theme']> {
	const colors = await getDynamicTheme();
	const vars: Record<string, string> = {};
	for (const name of THEME_VARS)
		vars[name] = (colors[`--${name}` as keyof typeof colors] ?? '').trim();
	return { vars, dark: !!get(darkModeStore) };
}

export function readWebStrings(translate: (key: string) => string): Record<string, string> {
	return Object.fromEntries(WEB_STRING_KEYS.map((key) => [key, translate(`loginQr.web.${key}`)]));
}

export interface TvLoginEvents {
	onSuccess?: (auth: { username: string; token: string }) => void;
	onNewCode?: (code: string) => void;
	onError?: (message: string) => void;
}

export async function generateLoginCode(): Promise<string> {
	await sodium.ready;
	const bytes = sodium.randombytes_buf(6);
	return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

export async function generateLoginSecret(): Promise<string> {
	await sodium.ready;
	return sodium.to_base64(sodium.randombytes_buf(16), sodium.base64_variants.URLSAFE_NO_PADDING);
}

export async function startTvLoginSession(session: TvLoginSession): Promise<void> {
	await NodeJS.whenReady();
	await NodeJS.send({ eventName: 'tv-login:start', args: [session] });
}

export async function stopTvLoginSession(): Promise<void> {
	await NodeJS.send({ eventName: 'tv-login:stop', args: [] });
}

export async function addTvLoginListeners(events: TvLoginEvents): Promise<PluginListenerHandle[]> {
	const handles: PluginListenerHandle[] = [];
	await NodeJS.whenReady();

	if (events.onSuccess) {
		handles.push(
			await NodeJS.addListener('tv-login:success', (event) => {
				const [auth] = event.args;
				if (auth && typeof auth.username === 'string' && typeof auth.token === 'string') {
					events.onSuccess!(auth);
				} else {
					events.onError?.('Invalid login response');
				}
			})
		);
	}

	if (events.onNewCode) {
		handles.push(
			await NodeJS.addListener('tv-login:new-code', (event) => {
				const [data] = event.args;
				if (data && typeof data.code === 'string') events.onNewCode!(data.code);
			})
		);
	}

	if (events.onError) {
		handles.push(
			await NodeJS.addListener('tv-login:error', (event) => {
				const [data] = event.args;
				events.onError!(data?.message ?? 'Unknown error');
			})
		);
	}

	return handles;
}
