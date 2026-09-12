import { buildTheme, type Preset } from './shared';

export const tokyoNightPresets: Preset[] = [
	{
		id: 'tokyo-night',
		family: 'Tokyo Night',
		label: 'Tokyo Night',
		dark: true,
		colors: buildTheme(
			{
				primary: '#7aa2f7',
				primaryContainer: '#3b4261',
				secondary: '#bb9af7',
				secondaryContainer: '#292e42',
				tertiary: '#7dcfff',
				tertiaryContainer: '#292e42',
				error: '#f7768e',
				errorContainer: '#db4b4b',
				background: '#1a1b26',
				backgroundAlt: '#16161e',
				backgroundDarker: '#111116',
				surfaceLow: '#292e42',
				surfaceHigh: '#323649',
				onSurface: '#c0caf5',
				onSurfaceVariant: '#565f89',
				outline: '#565f89',
				outlineVariant: '#3b4261'
			},
			true
		)
	},
	{
		id: 'tokyo-night-storm',
		family: 'Tokyo Night',
		label: 'Tokyo Night Storm',
		dark: true,
		colors: buildTheme(
			{
				primary: '#7aa2f7',
				primaryContainer: '#3d445e',
				secondary: '#bb9af7',
				secondaryContainer: '#292e42',
				tertiary: '#7dcfff',
				tertiaryContainer: '#292e42',
				error: '#f7768e',
				errorContainer: '#db4b4b',
				background: '#24283b',
				backgroundAlt: '#1f2335',
				backgroundDarker: '#191d2d',
				surfaceLow: '#292e42',
				surfaceHigh: '#3a4057',
				onSurface: '#c0caf5',
				onSurfaceVariant: '#565f89',
				outline: '#565f89',
				outlineVariant: '#3d445e'
			},
			true
		)
	},
	{
		id: 'tokyo-night-day',
		family: 'Tokyo Night',
		label: 'Tokyo Night Day',
		dark: false,
		colors: buildTheme(
			{
				primary: '#2e7de9',
				primaryContainer: '#e9e9ec',
				secondary: '#9854f1',
				secondaryContainer: '#e9e9ec',
				tertiary: '#0f4b6e',
				tertiaryContainer: '#e9e9ec',
				error: '#8c4351',
				errorContainer: '#f5c8cc',
				background: '#e1e2e7',
				backgroundAlt: '#d5d6db',
				backgroundDarker: '#c8cad1',
				surfaceLow: '#e9e9ec',
				surfaceHigh: '#ffffff',
				onSurface: '#3760bf',
				onSurfaceVariant: '#6f7aad',
				outline: '#565f89',
				outlineVariant: '#c8cad1'
			},
			false
		)
	}
];
