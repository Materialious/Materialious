import type { ThemeColors } from '../index';

export type Preset = {
	id: string;
	family: string;
	label: string;
	dark: boolean;
	colors: ThemeColors;
};

export type MaterialSeed = {
	primary: string;
	primaryContainer: string;
	secondary: string;
	secondaryContainer: string;
	tertiary: string;
	tertiaryContainer: string;
	error: string;
	errorContainer: string;
	background: string;
	backgroundAlt: string;
	backgroundDarker: string;
	surfaceLow: string;
	surfaceHigh: string;
	onSurface: string;
	onSurfaceVariant: string;
	outline: string;
	outlineVariant: string;
};

function isLight(hex: string): boolean {
	const value = hex.replace('#', '');
	const r = parseInt(value.substring(0, 2), 16);
	const g = parseInt(value.substring(2, 4), 16);
	const b = parseInt(value.substring(4, 6), 16);
	const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
	return luminance > 0.4;
}

export function buildTheme(seed: MaterialSeed, dark: boolean): ThemeColors {
	const darkOn = dark ? seed.background : seed.onSurface;
	const lightOn = dark ? seed.onSurface : '#ffffff';
	const onContainer = (container: string) => (isLight(container) ? darkOn : lightOn);

	return {
		'--primary': seed.primary,
		'--on-primary': seed.background,
		'--primary-container': seed.primaryContainer,
		'--on-primary-container': onContainer(seed.primaryContainer),
		'--secondary': seed.secondary,
		'--on-secondary': seed.background,
		'--secondary-container': seed.secondaryContainer,
		'--on-secondary-container': onContainer(seed.secondaryContainer),
		'--tertiary': seed.tertiary,
		'--on-tertiary': seed.background,
		'--tertiary-container': seed.tertiaryContainer,
		'--on-tertiary-container': onContainer(seed.tertiaryContainer),
		'--error': seed.error,
		'--on-error': seed.background,
		'--error-container': seed.errorContainer,
		'--on-error-container': onContainer(seed.errorContainer),
		'--background': seed.background,
		'--on-background': seed.onSurface,
		'--surface': seed.background,
		'--on-surface': seed.onSurface,
		'--surface-variant': seed.surfaceLow,
		'--on-surface-variant': seed.onSurfaceVariant,
		'--outline': seed.outline,
		'--outline-variant': seed.outlineVariant,
		'--shadow': seed.backgroundDarker,
		'--scrim': seed.backgroundDarker,
		'--inverse-surface': seed.surfaceHigh,
		'--inverse-on-surface': seed.background,
		'--inverse-primary': seed.primary,
		'--surface-dim': seed.backgroundAlt,
		'--surface-bright': dark ? seed.surfaceHigh : seed.background,
		'--surface-container-lowest': dark ? seed.backgroundDarker : seed.background,
		'--surface-container-low': seed.backgroundAlt,
		'--surface-container': dark ? seed.surfaceLow : seed.backgroundDarker,
		'--surface-container-high': seed.surfaceLow,
		'--surface-container-highest': seed.surfaceHigh
	};
}
