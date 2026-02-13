import adapterStatic from '@sveltejs/adapter-static';
import adapterNode from '@sveltejs/adapter-node';

import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const useSsr = process.env.VITE_BUILD_WITH_BACKEND === 'true';

const adapter = useSsr
	? adapterNode()
	: adapterStatic({
			fallback: 'index.html'
		});

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter
	}
};

export default config;
