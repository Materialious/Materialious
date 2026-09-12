import { buildTheme, type Preset } from './shared';

export const gruvboxPresets: Preset[] = [
	{
		id: 'gruvbox-dark',
		family: 'Gruvbox',
		label: 'Gruvbox Dark',
		dark: true,
		colors: buildTheme(
			{
				primary: '#fabd2f',
				primaryContainer: '#504945',
				secondary: '#83a598',
				secondaryContainer: '#504945',
				tertiary: '#d3869b',
				tertiaryContainer: '#504945',
				error: '#fb4934',
				errorContainer: '#cc241d',
				background: '#282828',
				backgroundAlt: '#3c3836',
				backgroundDarker: '#1d2021',
				surfaceLow: '#504945',
				surfaceHigh: '#665c54',
				onSurface: '#fbf1c7',
				onSurfaceVariant: '#d5c4a1',
				outline: '#7c6f64',
				outlineVariant: '#665c54'
			},
			true
		)
	},
	{
		id: 'gruvbox-light',
		family: 'Gruvbox',
		label: 'Gruvbox Light',
		dark: false,
		colors: buildTheme(
			{
				primary: '#d79921',
				primaryContainer: '#ebdbb2',
				secondary: '#458588',
				secondaryContainer: '#ebdbb2',
				tertiary: '#8f3f71',
				tertiaryContainer: '#ebdbb2',
				error: '#cc241d',
				errorContainer: '#f6c7be',
				background: '#fbf1c7',
				backgroundAlt: '#ebdbb2',
				backgroundDarker: '#d5c4a1',
				surfaceLow: '#bdae93',
				surfaceHigh: '#a89984',
				onSurface: '#282828',
				onSurfaceVariant: '#665c54',
				outline: '#a89984',
				outlineVariant: '#bdae93'
			},
			false
		)
	}
];
