import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { fileURLToPath, URL } from 'node:url';
import { vite as vidstack } from 'vidstack/plugins';
import { defineConfig } from 'vite';

const viteServerConfig = {
	name: "configure-response-headers",
	configureServer(server) {
		server.middlewares.use((req, res, next) => {
			res.setHeader("Access-Control-Allow-Origin", "*");
			res.setHeader("Access-Control-Allow-Methods", "GET");
			res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
			res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
			next();
		});
	}
};


export default defineConfig({
	plugins: [
		viteServerConfig,
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
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url))
		}
	},
	optimizeDeps: {
		exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
	},
	server: {
		headers: {
			'Cross-Origin-Opener-Policy': 'same-origin',
			'Cross-Origin-Embedder-Policy': 'require-corp'
		},
		fs: {
			allow: ['../..']
		}
	}
});
