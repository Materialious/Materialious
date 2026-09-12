import { buildTheme, type MaterialSeed, type Preset } from './shared';

type CatppuccinColors = {
	base: string;
	mantle: string;
	crust: string;
	surface0: string;
	surface1: string;
	overlay0: string;
	overlay1: string;
	subtext0: string;
	subtext1: string;
	text: string;
	lavender: string;
	blue: string;
	sky: string;
	flamingo: string;
	maroon: string;
	red: string;
	mauve: string;
	pink: string;
};

export type CatppuccinFlavor = 'latte' | 'frappe' | 'macchiato' | 'mocha';

const palettes: Record<CatppuccinFlavor, CatppuccinColors> = {
	latte: {
		base: '#eff1f5',
		mantle: '#e6e9ef',
		crust: '#dce0e8',
		surface0: '#ccd0da',
		surface1: '#bcc0cc',
		overlay0: '#9ca0b0',
		overlay1: '#8c8fa1',
		subtext0: '#6c6f85',
		subtext1: '#5c5f77',
		text: '#4c4f69',
		lavender: '#7287fd',
		blue: '#1e66f5',
		sky: '#04a5e5',
		flamingo: '#dd7878',
		maroon: '#e64553',
		red: '#d20f39',
		mauve: '#8839ef',
		pink: '#ea76cb'
	},
	frappe: {
		base: '#303446',
		mantle: '#292c3c',
		crust: '#232634',
		surface0: '#414559',
		surface1: '#51576d',
		overlay0: '#737994',
		overlay1: '#838ba7',
		subtext0: '#a5adce',
		subtext1: '#b5bfe2',
		text: '#c6d0f5',
		lavender: '#b4befe',
		blue: '#8caaee',
		sky: '#99d1db',
		flamingo: '#eebebe',
		maroon: '#ea999c',
		red: '#e78284',
		mauve: '#ca9ee6',
		pink: '#f4b8e4'
	},
	macchiato: {
		base: '#24273a',
		mantle: '#1e2030',
		crust: '#181926',
		surface0: '#363a4f',
		surface1: '#494d64',
		overlay0: '#6e738d',
		overlay1: '#8087a2',
		subtext0: '#a5adcb',
		subtext1: '#b8c0e0',
		text: '#cad3f5',
		lavender: '#b4befe',
		blue: '#8aadf4',
		sky: '#91d7e3',
		flamingo: '#f0c6c6',
		maroon: '#ee99a0',
		red: '#ed8796',
		mauve: '#c6a0f6',
		pink: '#f5bde6'
	},
	mocha: {
		base: '#1e1e2e',
		mantle: '#181825',
		crust: '#11111b',
		surface0: '#313244',
		surface1: '#45475a',
		overlay0: '#6c7086',
		overlay1: '#7f849c',
		subtext0: '#a6adc8',
		subtext1: '#bac2de',
		text: '#cdd6f4',
		lavender: '#b4befe',
		blue: '#89b4fa',
		sky: '#89dceb',
		flamingo: '#f2cdcd',
		maroon: '#eba0ac',
		red: '#f38ba8',
		mauve: '#cba6f7',
		pink: '#f5c2e7'
	}
};

function toSeed(p: CatppuccinColors, dark: boolean): MaterialSeed {
	return {
		primary: p.mauve,
		primaryContainer: p.lavender,
		secondary: p.blue,
		secondaryContainer: p.sky,
		tertiary: p.pink,
		tertiaryContainer: p.flamingo,
		error: p.red,
		errorContainer: p.maroon,
		background: p.base,
		backgroundAlt: p.mantle,
		backgroundDarker: p.crust,
		surfaceLow: p.surface0,
		surfaceHigh: p.surface1,
		onSurface: p.text,
		onSurfaceVariant: dark ? p.subtext1 : p.subtext0,
		outline: p.overlay1,
		outlineVariant: p.overlay0
	};
}

export const catppuccinFlavors: CatppuccinFlavor[] = ['latte', 'frappe', 'macchiato', 'mocha'];

export const catppuccinPresets: Preset[] = catppuccinFlavors.map((id) => {
	const dark = id !== 'latte';
	return {
		id,
		family: 'Catppuccin',
		label: `Catppuccin ${id.charAt(0).toUpperCase()}${id.slice(1)}`,
		dark,
		colors: buildTheme(toSeed(palettes[id], dark), dark)
	};
});
