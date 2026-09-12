import { buildTheme, type Preset } from './shared';

export const nordPresets: Preset[] = [
	{
		id: 'nord',
		family: 'Nord',
		label: 'Nord',
		dark: true,
		colors: buildTheme(
			{
				primary: '#88c0d0',
				primaryContainer: '#5e81ac',
				secondary: '#81a1c1',
				secondaryContainer: '#8fbcbb',
				tertiary: '#b48ead',
				tertiaryContainer: '#d08770',
				error: '#bf616a',
				errorContainer: '#bf616a',
				background: '#3b4252',
				backgroundAlt: '#2e3440',
				backgroundDarker: '#2e3440',
				surfaceLow: '#434c5e',
				surfaceHigh: '#4c566a',
				onSurface: '#eceff4',
				onSurfaceVariant: '#d8dee9',
				outline: '#4c566a',
				outlineVariant: '#434c5e'
			},
			true
		)
	},
	{
		id: 'nord-light',
		family: 'Nord',
		label: 'Nord Light',
		dark: false,
		colors: buildTheme(
			{
				primary: '#5e81ac',
				primaryContainer: '#88c0d0',
				secondary: '#81a1c1',
				secondaryContainer: '#8fbcbb',
				tertiary: '#b48ead',
				tertiaryContainer: '#d08770',
				error: '#bf616a',
				errorContainer: '#d98b93',
				background: '#eceff4',
				backgroundAlt: '#e5e9f0',
				backgroundDarker: '#d8dee9',
				surfaceLow: '#e5e9f0',
				surfaceHigh: '#e5e9f0',
				onSurface: '#4c566a',
				onSurfaceVariant: '#6b7a90',
				outline: '#8a97a8',
				outlineVariant: '#d8dee9'
			},
			false
		)
	}
];
