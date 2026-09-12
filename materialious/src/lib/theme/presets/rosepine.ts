import { buildTheme, type Preset } from './shared';

export const rosepinePresets: Preset[] = [
	{
		id: 'rosepine',
		family: 'Rosé Pine',
		label: 'Rosé Pine',
		dark: true,
		colors: buildTheme(
			{
				primary: '#c4a7e7',
				primaryContainer: '#524f67',
				secondary: '#31748f',
				secondaryContainer: '#403d52',
				tertiary: '#eb6f92',
				tertiaryContainer: '#403d52',
				error: '#eb6f92',
				errorContainer: '#ebbcba',
				background: '#191724',
				backgroundAlt: '#1f1d2e',
				backgroundDarker: '#131320',
				surfaceLow: '#26233a',
				surfaceHigh: '#312f44',
				onSurface: '#e0def4',
				onSurfaceVariant: '#908caa',
				outline: '#6e6a86',
				outlineVariant: '#26233a'
			},
			true
		)
	},
	{
		id: 'rosepine-moon',
		family: 'Rosé Pine',
		label: 'Rosé Pine Moon',
		dark: true,
		colors: buildTheme(
			{
				primary: '#c4a7e7',
				primaryContainer: '#46415f',
				secondary: '#3e8fb0',
				secondaryContainer: '#343040',
				tertiary: '#eb6f92',
				tertiaryContainer: '#3d3a52',
				error: '#eb6f92',
				errorContainer: '#ea9a97',
				background: '#232136',
				backgroundAlt: '#2a273f',
				backgroundDarker: '#1b1927',
				surfaceLow: '#343040',
				surfaceHigh: '#3d3a52',
				onSurface: '#e0def4',
				onSurfaceVariant: '#908caa',
				outline: '#6e6a86',
				outlineVariant: '#343040'
			},
			true
		)
	},
	{
		id: 'rosepine-dawn',
		family: 'Rosé Pine',
		label: 'Rosé Pine Dawn',
		dark: false,
		colors: buildTheme(
			{
				primary: '#907aa9',
				primaryContainer: '#f2e9de',
				secondary: '#286983',
				secondaryContainer: '#f2e9de',
				tertiary: '#b4637a',
				tertiaryContainer: '#f2e9de',
				error: '#e04e6d',
				errorContainer: '#f2e9de',
				background: '#faf4ed',
				backgroundAlt: '#fffaf3',
				backgroundDarker: '#f2e9de',
				surfaceLow: '#f2e9de',
				surfaceHigh: '#fffaf3',
				onSurface: '#575279',
				onSurfaceVariant: '#797593',
				outline: '#9893a5',
				outlineVariant: '#f2e9de'
			},
			false
		)
	}
];
