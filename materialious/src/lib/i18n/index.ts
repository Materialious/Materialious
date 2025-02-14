import { browser } from '$app/environment';
import { init, register } from 'svelte-i18n';

const defaultLocale = 'en';

register('en', () => import('./locales/en.json'));
register('ru', () => import('./locales/ru.json'));
register('zh-CN', () => import('./locales/zh-CN.json'));
register('tr', () => import('./locales/tr.json'));
register('nl', () => import('./locales/nl.json'));
register('de', () => import('./locales/de.json'));
register('es', () => import('./locales/es.json'));
register('sh', () => import('./locales/sh.json'));
register('pt-BR', () => import('./locales/pt-BR.json'));

init({
	fallbackLocale: defaultLocale,
	initialLocale: browser ? window.navigator.language : defaultLocale
});
