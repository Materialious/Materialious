import { App } from '@capacitor/app';
import { get } from 'svelte/store';
import { gt, valid } from 'semver';
import { tvUpdateState } from '#lib/stores/tvUpdate';

type ApkUpdater = {
	download: (
		url: string,
		options: { onDownloadProgress: (event: { progress: number }) => void }
	) => Promise<{ app: { package: string; version: { code: number } } }>;
	install: () => Promise<unknown>;
};

async function getUpdater(): Promise<ApkUpdater> {
	for (let attempt = 0; attempt < 50; attempt++) {
		const updater = (window as typeof window & { ApkUpdater?: ApkUpdater }).ApkUpdater;
		if (updater) return updater;
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
	throw new Error('APK updater is unavailable');
}

export async function checkForTvUpdate(prompt = false): Promise<void> {
	if (['checking', 'downloading', 'installing'].includes(get(tvUpdateState).status)) return;
	const promptAlreadyOpen = get(tvUpdateState).prompt;
	tvUpdateState.set({ status: 'checking', prompt: promptAlreadyOpen });
	try {
		const [info, response] = await Promise.all([
			App.getInfo(),
			fetch('https://api.github.com/repos/Materialious/Materialious/releases/latest')
		]);
		if (!response.ok) throw new Error(`Release lookup failed (${response.status})`);
		const release: { tag_name: string; assets: { name: string; browser_download_url: string }[] } =
			await response.json();
		const latest = valid(release.tag_name);
		const installed = valid(info.version);
		if (!latest || !installed) throw new Error('Unable to compare app versions');
		if (!gt(latest, installed)) {
			tvUpdateState.set({ status: 'current' });
			return;
		}
		const asset = release.assets.find(
			(item) => item.name === 'app-universal-release-tv-signed.apk'
		);
		if (!asset) throw new Error('The TV APK is not available in the latest release yet');
		const url = new URL(asset.browser_download_url);
		if (
			url.protocol !== 'https:' ||
			url.hostname !== 'github.com' ||
			!url.pathname.startsWith('/Materialious/Materialious/releases/download/')
		)
			throw new Error('Unexpected update URL');
		tvUpdateState.set({ status: 'available', version: latest, url: url.href, prompt });
	} catch (error) {
		tvUpdateState.set({
			status: 'error',
			prompt: promptAlreadyOpen,
			message: error instanceof Error ? error.message : 'Update check failed'
		});
	}
}

export async function installTvUpdate(): Promise<void> {
	const state = get(tvUpdateState);
	if (state.status !== 'available' || !state.url) return;
	tvUpdateState.set({ ...state, status: 'downloading', progress: 0 });
	try {
		const [updater, info] = await Promise.all([getUpdater(), App.getInfo()]);
		const downloaded = await updater.download(state.url, {
			onDownloadProgress: (event) => {
				if (Number.isFinite(event.progress))
					tvUpdateState.update((current) => ({
						...current,
						progress: Math.max(0, Math.min(100, event.progress))
					}));
			}
		});
		if (downloaded.app.package !== info.id || downloaded.app.version.code <= Number(info.build))
			throw new Error('Downloaded APK does not match this app or is not newer');
		tvUpdateState.update((current) => ({ ...current, status: 'installing' }));
		await updater.install();
		tvUpdateState.set({ ...state, prompt: false });
	} catch (error) {
		tvUpdateState.set({
			...state,
			prompt: get(tvUpdateState).prompt,
			status: 'error',
			message: error instanceof Error ? error.message : 'Update failed'
		});
	}
}
