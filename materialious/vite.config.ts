import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { vite as vidstack } from 'vidstack/plugins';
import { defineConfig } from 'vite';


export default defineConfig({
	plugins: [
		SvelteKitPWA({
			injectRegister: 'inline',
			manifest: {
				description: 'Modern material design for Invidious.',
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
		vidstack(),
		sveltekit()
	],
	optimizeDeps: {
		exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
	},
});
