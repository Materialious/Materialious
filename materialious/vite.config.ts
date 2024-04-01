import { sveltekit } from '@sveltejs/kit/vite';
import { vite as vidstack } from 'vidstack/plugins';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	ssr: {
		noExternal: ['beercss']
	},
	plugins: [
		VitePWA({
			manifest: {
				description: "Modern material design for Invidious.",
				icons: [
					{
						src: "/android-chrome-512x512.png",
						sizes: "512x512",
						type: "image/png",
					},
					{
						src: "/android-icon-192x192.png",
						sizes: "192x192",
						type: "image/png",
					}
				],
				background_color: "#22005d",
				theme_color: "#efb0ff"
			}
		}),
		vidstack(),
		sveltekit()
	],
});
