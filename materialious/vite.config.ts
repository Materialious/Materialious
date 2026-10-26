import adapterStatic from '@sveltejs/adapter-static';
import adapterNode from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';
import pkg from './package.json';
import path from 'path';

const useSsr = process.env.PUBLIC_BUILD_WITH_BACKEND === 'true';

const adapter = useSsr
	? adapterNode({ out: 'build', precompress: true })
	: adapterStatic({ fallback: 'index.html' });

export default defineConfig({
	resolve: {
		alias: {
			'#lib': path.resolve('./src/lib')
		},
		extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.svelte']
	},
	plugins: [
		SvelteKitPWA({
			injectRegister: 'inline',
			workbox: {
				maximumFileSizeToCacheInBytes: 4000000
			},
			manifest: {
				description: 'Modern material design for YouTube and Invidious.',
				theme_color: '#8936FF',
				background_color: '#1e1b1e',
				icons: [
					{
						purpose: 'maskable',
						sizes: '512x512',
						src: 'icon512-maskable.png',
						type: 'image/png'
					},
					{
						purpose: 'any',
						sizes: '512x512',
						src: 'icon512-any.png',
						type: 'image/png'
					}
				],
				display: 'standalone',
				name: 'Materialious',
				short_name: 'Materialious'
			}
		}),
		sveltekit({ preprocess: vitePreprocess(), adapter })
	],
	ssr: {
		noExternal: ['beercss']
	},
	define: {
		'import.meta.env.APP_VERSION': JSON.stringify(pkg.version)
	},
	server: {
		fs: {
			allow: ['static/inter.ttf']
		}
	}
});
