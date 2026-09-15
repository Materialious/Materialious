import { z } from 'zod';
import { zBoolean, zNumber, zThemeColors } from '$lib/externalSettings/settings';
import type { CustomPreset } from './presets';
import type { ThemeColors } from './index';

export const zThemeFile = z.object({
	name: z.string(),
	dark: zBoolean.default(true),
	colors: zThemeColors,
	borderRadius: zNumber.default(0.5)
});

export function serializeThemeFile(
	name: string,
	colors: ThemeColors,
	dark: boolean,
	borderRadius: number
): string {
	return JSON.stringify({
		name,
		dark,
		colors,
		borderRadius
	});
}

export function parseThemeFile(content: string): Omit<CustomPreset, 'id' | 'family'> | undefined {
	let fileJson: unknown;
	try {
		fileJson = JSON.parse(content);
	} catch {
		return undefined;
	}

	const parsed = zThemeFile.safeParse(fileJson);
	if (!parsed.success) return undefined;

	return {
		label: parsed.data.name,
		dark: parsed.data.dark,
		colors: parsed.data.colors,
		borderRadius: parsed.data.borderRadius
	};
}
