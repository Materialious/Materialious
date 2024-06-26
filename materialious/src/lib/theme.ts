import ui from 'beercss';

export async function getDynamicTheme(mode?: string): Promise<Record<string, string>> {
	const givenSettings = (await ui('theme'));

	// @ts-ignore
	const themes: string = givenSettings[mode ? mode : (ui('mode') as string)];
	let themeVars: Record<string, string> = {};
	themes.split(';').forEach((keyVar) => {
		let [key, value] = keyVar.split(':');
		themeVars[key] = value;
	});
	return themeVars;
}
