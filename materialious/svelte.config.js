import adapterStatic from '@sveltejs/adapter-static';
import adapterNode from '@sveltejs/adapter-node';

import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const useSsr = process.env.PUBLIC_BUILD_WITH_BACKEND === 'true';

const adapter = useSsr
	? adapterNode({ out: 'build', precompress: true })
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
