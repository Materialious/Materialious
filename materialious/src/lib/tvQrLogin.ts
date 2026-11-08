import { NodeJS } from 'capacitor-nodejs';
import type { PluginListenerHandle } from '@capacitor/core';

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
	'redirecting',
	'redirectingHint',
	'redirectingAction',
	'doneTitle',
	'doneBody',
	'expiredTitle',
	'expiredBody',
	'invalidTitle',
	'invalidBody'
];

// Reads the colors BeerCSS currently applies to the body (validated again on the Node side).
export function readTheme(): TvLoginSession['theme'] {
	const style = getComputedStyle(document.body);
	const vars: Record<string, string> = {};
	for (const name of THEME_VARS) vars[name] = style.getPropertyValue(`--${name}`).trim();
	return { vars, dark: document.body.classList.contains('dark') };
}

export function readWebStrings(translate: (key: string) => string): Record<string, string> {
	return Object.fromEntries(WEB_STRING_KEYS.map((key) => [key, translate(`loginQr.web.${key}`)]));
}

export interface TvLoginEvents {
	onSuccess?: (auth: { username: string; token: string }) => void;
	onNewCode?: (code: string) => void;
	onError?: (message: string) => void;
}

export function generateLoginCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(6));
	let code = '';
	for (let i = 0; i < 6; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
	return code;
}

export function generateLoginSecret(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '');
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
