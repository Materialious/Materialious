import { buildTheme, type Preset } from './shared';

export const everforestPresets: Preset[] = [
	{
		id: 'everforest-dark',
		family: 'Everforest',
		label: 'Everforest Dark',
		dark: true,
		colors: buildTheme(
			{
				primary: '#a7c080',
				primaryContainer: '#2f383e',
				secondary: '#7fbbb3',
				secondaryContainer: '#2f383e',
				tertiary: '#d699b6',
				tertiaryContainer: '#2f383e',
				error: '#e67e80',
				errorContainer: '#b85450',
				background: '#1e2326',
				backgroundAlt: '#272e33',
				backgroundDarker: '#16191c',
				surfaceLow: '#2f383e',
				surfaceHigh: '#333c43',
				onSurface: '#d3c6aa',
				onSurfaceVariant: '#859289',
				outline: '#859289',
				outlineVariant: '#3a434a'
			},
			true
		)
	},
	{
		id: 'everforest-light',
		family: 'Everforest',
		label: 'Everforest Light',
		dark: false,
		colors: buildTheme(
			{
				primary: '#83a400',
				primaryContainer: '#f8f5e8',
				secondary: '#35a77c',
				secondaryContainer: '#f8f5e8',
				tertiary: '#df69ba',
				tertiaryContainer: '#f8f5e8',
				error: '#f85552',
				errorContainer: '#ffe5e3',
				background: '#fffbef',
				backgroundAlt: '#f8f5e8',
				backgroundDarker: '#efe9da',
				surfaceLow: '#e8e3d3',
				surfaceHigh: '#ffffff',
				onSurface: '#5c6a72',
				onSurfaceVariant: '#9da9a0',
				outline: '#9da9a0',
				outlineVariant: '#e8e3d3'
			},
			false
		)
	}
];
