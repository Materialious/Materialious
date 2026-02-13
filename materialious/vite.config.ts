import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';
import pkg from './package.json';

export default defineConfig({
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
						src: 'icon512_maskable.png',
						type: 'image/png'
					},
					{
						purpose: 'any',
						sizes: '512x512',
						src: 'icon512_rounded.png',
						type: 'image/png'
					}
				],
				orientation: 'any',
				display: 'standalone',
				name: 'Materialious'
			}
		}),
		sveltekit()
	],
	ssr: {
		noExternal: ['beercss', 'capacitor-music-controls-plugin']
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
