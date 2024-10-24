import ui from 'beercss';
import { get } from 'svelte/store';
import { darkModeStore, interfaceAmoledTheme } from './store';

export async function getDynamicTheme(mode?: string): Promise<Record<string, string>> {
	const givenSettings = (await ui('theme'));

	// @ts-ignore
	const themes: string = givenSettings[mode ? mode : (ui('mode') as string)];
	let themeVars: Record<string, string> = {};
	themes.split(';').forEach((keyVar) => {
		let [key, value] = keyVar.split(':');
		themeVars[key] = value;
	});
	return themeVars;
}



export function setAmoledTheme() {
	const isAmoled = get(interfaceAmoledTheme);
	const isDark = get(darkModeStore);

	if (isAmoled && isDark) {
		const rootVars = [
			'--surface-container',
			'--surface',
			'--surface-container-lowest',
			'--surface-container-low',
			'--surface-container-high',
			'--surface-container-highest'
		];
		rootVars.forEach((varName) => {
			document.body.style.setProperty(varName, '#000');
		});
	} else {
		setTheme();
	}
}

export function setTheme() {
	const isDark = get(darkModeStore);

	if (isDark === null) {
		if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
			darkModeStore.set(true);
			ui('mode', 'dark');
		} else {
			darkModeStore.set(false);
			ui('mode', 'light');
		}
	} else {
		if (isDark) {
			ui('mode', 'dark');
		} else {
			ui('mode', 'light');
		}
	}
}