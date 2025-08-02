import i18next, { type InitOptions } from 'i18next';
import { writable, type Writable } from 'svelte/store';

const defaultLocale = 'en';

export const locale: Writable<string> = writable(defaultLocale);
export const _: Writable<(key: string, options?: any) => string> = writable(() => '');

const resources: Record<string, () => Promise<Record<string, any>>> = {
	ar: () => import('./locales/ar.json'),
	en: () => import('./locales/en.json'),
	ru: () => import('./locales/ru.json'),
	'zh-CN': () => import('./locales/zh-CN.json'),
	tr: () => import('./locales/tr.json'),
	nl: () => import('./locales/nl.json'),
	de: () => import('./locales/de.json'),
	es: () => import('./locales/es.json'),
	gsw: () => import('./locales/gsw.json'),
	sh: () => import('./locales/sh.json'),
	'pt-BR': () => import('./locales/pt-BR.json'),
	lv: () => import('./locales/lv.json'),
	ja: () => import('./locales/ja.json'),
	mi: () => import('./locales/mi.json')
};

function getUserLocale(): string {
	if (typeof navigator !== 'undefined') {
		for (const lang of navigator.languages) {
			if (resources[lang]) {
				return lang;
			}
			// In case of a regional code (e.g. 'de-CH'), fallback to the more general lang
			const baseLang = lang.split('-')[0]
			if (resources[baseLang]) {
				return baseLang
			}
		}
	}
	return defaultLocale;
}

export async function initI18n(selectedLocale: string = getUserLocale()): Promise<void> {
	const langToLoad = resources[selectedLocale] ? selectedLocale : defaultLocale;
	const translations = await resources[langToLoad]();
	const fallbackTranslations = await resources[defaultLocale]();

	const options: InitOptions = {
		lng: langToLoad,
		fallbackLng: defaultLocale,
		resources: {
			[langToLoad]: {
				translation: translations.default || translations
			},
			[defaultLocale]: {
				translation: fallbackTranslations.default || fallbackTranslations
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
