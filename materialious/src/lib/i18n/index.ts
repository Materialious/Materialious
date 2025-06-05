import i18next, { type InitOptions } from 'i18next';
import { writable, type Writable } from 'svelte/store';

const defaultLocale = 'en';

export const locale: Writable<string> = writable(defaultLocale);
export const _: Writable<(key: string, options?: any) => string> = writable(() => '');

const resources: Record<string, () => Promise<Record<string, any>>> = {
	en: () => import('./locales/en.json'),
	ru: () => import('./locales/ru.json'),
	'zh-CN': () => import('./locales/zh-CN.json'),
	tr: () => import('./locales/tr.json'),
	nl: () => import('./locales/nl.json'),
	de: () => import('./locales/de.json'),
	es: () => import('./locales/es.json'),
	sh: () => import('./locales/sh.json'),
	'pt-BR': () => import('./locales/pt-BR.json')
};

function getUserLocale(): string {
	if (typeof navigator !== 'undefined') {
		const lang = navigator.language;
		return resources[lang] ? lang : defaultLocale;
	}
	return defaultLocale;
}

export async function initI18n(selectedLocale: string = getUserLocale()): Promise<void> {
	const langToLoad = resources[selectedLocale] ? selectedLocale : defaultLocale;
	const translations = await resources[langToLoad]();

	const options: InitOptions = {
		lng: langToLoad,
		fallbackLng: defaultLocale,
		resources: {
			[langToLoad]: {
				translation: translations.default || translations
			}
		}
	};

	await i18next.init(options);

	locale.set(langToLoad);
	_.set(i18next.t.bind(i18next));

	window.addEventListener('languagechange', () => {
		const newLang = getUserLocale();
		initI18n(newLang);
	});
}
