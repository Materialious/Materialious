// Builds src/tv-login-web into ONE self-contained HTML file for the Android
// Node login listener (static/nodejsAndroid/login-web.html). Script and style
// are inlined so the listener only serves a single response; it allows them
// in its CSP by sha256 hash.
import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve('src/tv-login-web');
const outDir = path.resolve('.svelte-kit/tv-login-web');

rmSync(outDir, { recursive: true, force: true });
await build({
	root,
	base: './',
	logLevel: 'warn',
	configFile: false,
	plugins: [svelte({ preprocess: vitePreprocess() })],
	build: { outDir, emptyOutDir: true, cssCodeSplit: false, assetsInlineLimit: 0 }
});

const html = readFileSync(path.join(outDir, 'index.html'), 'utf8');
const asset = (href) => readFileSync(path.join(outDir, href.replace(/^\.\//, '')), 'utf8');

const inlined = html
	.replace(/<script type="module"[^>]*src="[^"]+"[^>]*><\/script>/, '')
	.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/, (_, href) => {
		return `<style>${asset(href)}</style>`;
	});

const scriptSrc = html.match(/<script type="module"[^>]*src="([^"]+)"/)[1];
// The module script must come after #app and #state, so it goes at the end of <body>.
const js = asset(scriptSrc).replace(/<\/script/gi, '<\\/script');
const final = inlined.replace('</body>', `<script type="module">${js}</script>\n</body>`);

mkdirSync('static/nodejsAndroid', { recursive: true });
writeFileSync('static/nodejsAndroid/login-web.html', final);
console.log(`tv-login-web: ${(final.length / 1024).toFixed(0)} KB`);
