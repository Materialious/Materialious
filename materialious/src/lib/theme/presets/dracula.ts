import { buildTheme, type Preset } from './shared';

export const draculaPresets: Preset[] = [
	{
		id: 'dracula',
		family: 'Dracula',
		label: 'Dracula',
		dark: true,
		colors: buildTheme(
			{
				primary: '#bd93f9',
				primaryContainer: '#44475a',
				secondary: '#ff79c6',
				secondaryContainer: '#44475a',
				tertiary: '#50fa7b',
				tertiaryContainer: '#44475a',
				error: '#ff5555',
				errorContainer: '#ff7a7a',
				background: '#282a36',
				backgroundAlt: '#232530',
				backgroundDarker: '#1e1f28',
				surfaceLow: '#44475a',
				surfaceHigh: '#4b4e63',
				onSurface: '#f8f8f2',
				onSurfaceVariant: '#6272a4',
				outline: '#6272a4',
				outlineVariant: '#44475a'
			},
			true
		)
	},
	{
		id: 'dracula-lite',
		family: 'Dracula',
		label: 'Dracula Lite',
		dark: false,
		colors: buildTheme(
			{
				primary: '#7a5dd0',
				primaryContainer: '#f1eafd',
				secondary: '#d4306f',
				secondaryContainer: '#fce9f2',
				tertiary: '#2fa95a',
				tertiaryContainer: '#e6f9ec',
				error: '#e23838',
				errorContainer: '#ffe0e0',
				background: '#f8f8f2',
				backgroundAlt: '#ffffff',
				backgroundDarker: '#e9e9f0',
				surfaceLow: '#ececf5',
				surfaceHigh: '#ffffff',
				onSurface: '#282a36',
				onSurfaceVariant: '#6272a4',
				outline: '#8a90a8',
				outlineVariant: '#d3d6e0'
			},
			false
		)
	}
];
