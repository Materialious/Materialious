import { buildTheme, type Preset } from './shared';

export const solarizedPresets: Preset[] = [
	{
		id: 'solarized-dark',
		family: 'Solarized',
		label: 'Solarized Dark',
		dark: true,
		colors: buildTheme(
			{
				primary: '#268bd2',
				primaryContainer: '#073642',
				secondary: '#859900',
				secondaryContainer: '#073642',
				tertiary: '#6c71c4',
				tertiaryContainer: '#073642',
				error: '#dc322f',
				errorContainer: '#8c1f1d',
				background: '#002b36',
				backgroundAlt: '#073642',
				backgroundDarker: '#001821',
				surfaceLow: '#073642',
				surfaceHigh: '#586e75',
				onSurface: '#839496',
				onSurfaceVariant: '#93a1a1',
				outline: '#586e75',
				outlineVariant: '#073642'
			},
			true
		)
	},
	{
		id: 'solarized-light',
		family: 'Solarized',
		label: 'Solarized Light',
		dark: false,
		colors: buildTheme(
			{
				primary: '#268bd2',
				primaryContainer: '#eee8d5',
				secondary: '#859900',
				secondaryContainer: '#eee8d5',
				tertiary: '#6c71c4',
				tertiaryContainer: '#eee8d5',
				error: '#dc322f',
				errorContainer: '#f2d4d3',
				background: '#fdf6e3',
				backgroundAlt: '#eee8d5',
				backgroundDarker: '#e6e0cf',
				surfaceLow: '#eee8d5',
				surfaceHigh: '#dbd5c5',
				onSurface: '#657b83',
				onSurfaceVariant: '#586e75',
				outline: '#93a1a1',
				outlineVariant: '#eee8d5'
			},
			false
		)
	}
];
