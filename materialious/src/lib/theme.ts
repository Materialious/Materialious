import { Capacitor, SystemBarType } from '@capacitor/core';
import ui from 'beercss';
import { get } from 'svelte/store';
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { darkModeStore, interfaceAmoledTheme } from './store';

export type ThemeKey =
	| '--primary'
	| '--on-primary'
	| '--primary-container'
	| '--on-primary-container'
	| '--secondary'
	| '--on-secondary'
	| '--secondary-container'
	| '--on-secondary-container'
	| '--tertiary'
	| '--on-tertiary'
	| '--tertiary-container'
	| '--on-tertiary-container'
	| '--error'
	| '--on-error'
	| '--error-container'
	| '--on-error-container'
	| '--background'
	| '--on-background'
	| '--surface'
	| '--on-surface'
	| '--surface-variant'
	| '--on-surface-variant'
	| '--outline'
	| '--outline-variant'
	| '--shadow'
	| '--scrim'
	| '--inverse-surface'
	| '--inverse-on-surface'
	| '--inverse-primary'
	| '--surface-dim'
	| '--surface-bright'
	| '--surface-container-lowest'
	| '--surface-container-low'
	| '--surface-container'
	| '--surface-container-high'
	| '--surface-container-highest';

export type ThemeColors = Partial<Record<ThemeKey, string>>;

export async function getDynamicTheme(mode?: string): Promise<ThemeColors> {
	const givenSettings = await ui('theme');

	if (typeof givenSettings !== 'object') return {};

	// @ts-expect-error Works as expected
	const themes: string = givenSettings[mode ? mode : (ui('mode') as string)];
	const themeVars: Record<string, string> = {};
	for (const keyVar of themes.split(';')) {
		const [key, value] = keyVar.split(':');
		themeVars[key] = window.getComputedStyle(document.body).getPropertyValue(key) ?? value;
	}

	delete themeVars[''];

	return themeVars;
}

export async function setStatusBarColor() {
	if (Capacitor.getPlatform() !== 'android') return;
	await SystemBars.setStyle({
		style: get(darkModeStore) ? SystemBarsStyle.Dark : SystemBarsStyle.Light
	});
	await SystemBars.show({
		bar: SystemBarType.NavigationBar
	});
	await SystemBars.show({
		bar: SystemBarType.StatusBar
	});
}

export function setAmoledTheme() {
	const isAmoled = get(interfaceAmoledTheme);
	const isDark = get(darkModeStore);

	if (isAmoled && isDark) {
		const rootVars: ThemeKey[] = [
			'--surface-container',
			'--surface',
			'--surface-container-lowest',
			'--surface-container-low',
			'--surface-container-high',
			'--surface-container-highest'
		];
		rootVars.forEach((varName) => {
			setThemeColor(varName, '#000');
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

export function setThemeColors(theme: ThemeColors) {
	for (const [themeKey, themeValue] of Object.entries(theme)) {
		setThemeColor(themeKey as ThemeKey, themeValue.trim());
	}
}

export function setThemeColor(theme: ThemeKey, color: string) {
	document.documentElement.style.setProperty(theme, color.trim());
	document.body.style.setProperty(theme, color.trim());
}
