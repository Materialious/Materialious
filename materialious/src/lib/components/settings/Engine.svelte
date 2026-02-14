<script lang="ts">
	import { isYTBackend } from '$lib/misc';
	import { _ } from '$lib/i18n';
	import {
		invidiousAuthStore,
		engineCooldownYTStore,
		engineCullYTStore,
		engineFallbacksStore,
		engineMaxConcurrentChannelsStore,
		instanceStore
	} from '$lib/store';
	import { useEngineFallback, type EngineFallback } from '$lib/api/misc';
	import { get } from 'svelte/store';
	import { getSubscriptions, postSubscribe } from '$lib/api';
	import { postSubscribeYTjs } from '$lib/api/youtubejs/subscriptions';
	import { addToast } from '../Toast.svelte';

	const engineFallbacks: EngineFallback[] = [
		'Channel',
		'ChannelContent',
		'Comments',
		'ResolveUrl',
		'Search',
		'SearchSuggestions',
		'Video',
		'Playlist'
	];

	function enableFallback(event: Event) {
		if (!event.target) return;

		const fallback = (event.target as HTMLInputElement).value as EngineFallback;

		let enabledFallbacks = get(engineFallbacksStore);

		if (useEngineFallback(fallback)) {
			enabledFallbacks = enabledFallbacks.filter((item) => {
				return item !== fallback;
			});
		} else {
			enabledFallbacks.push(fallback);
		}

		engineFallbacksStore.set(enabledFallbacks);
	}

	async function importInvidiousSubs() {
		const importedSubs = await getSubscriptions({}, true);

		addToast({
			data: {
				text: $_('layout.backendEngine.importingToMaterialious')
			}
		});

		const subPromises: Promise<void>[] = [];
		importedSubs.forEach((sub) => {
			subPromises.push(postSubscribeYTjs(sub.authorId, sub.author));
		});

		await Promise.all(subPromises);

		addToast({
			data: {
				text: $_('layout.backendEngine.importingToMaterialiousFinished')
			}
		});
	}

	async function exportMaterialiousSubs() {
		const subs = await getSubscriptions();

		addToast({
			data: {
				text: $_('layout.backendEngine.exportingToInvidious')
			}
		});

		const subPromises: Promise<void>[] = [];
		subs.forEach((sub) => {
			subPromises.push(postSubscribe(sub.authorId, {}, true));
		});

		await Promise.all(subPromises);

		addToast({
			data: {
				text: $_('layout.backendEngine.exportingToInvidiousFinished')
			}
		});
	}
</script>

<article class="error-container">
	<p>{$_('layout.backendEngine.warning')}</p>
</article>

{#if isYTBackend()}
	<h6>Feed</h6>
	<div class="field label prefix surface-container-highest">
		<i>view_stream</i>
		<input
			oninput={(event: Event) => {
				engineCullYTStore.set(Number((event.target as HTMLInputElement).value));
			}}
			value={$engineCullYTStore}
			name="cull"
			type="number"
		/>
		<label for="cull">{$_('layout.backendEngine.cull')}</label>
	</div>
	<div class="field label prefix surface-container-highest">
		<i>schedule</i>
		<input
			oninput={(event: Event) => {
				engineCooldownYTStore.set(Number((event.target as HTMLInputElement).value));
			}}
			value={$engineCooldownYTStore}
			name="cooldown"
			type="number"
		/>
		<label for="cooldown">{$_('layout.backendEngine.cooldown')}</label>
	</div>
	<div class="field label prefix surface-container-highest">
		<i>pending</i>
		<input
			oninput={(event: Event) => {
				engineMaxConcurrentChannelsStore.set(Number((event.target as HTMLInputElement).value));
			}}
			value={$engineMaxConcurrentChannelsStore}
			name="concurrent"
			type="number"
		/>
		<label for="concurrent">{$_('layout.backendEngine.concurrent')}</label>
	</div>

	{#if $invidiousAuthStore && $instanceStore}
		<h6>{$_('layout.backendEngine.importExport')}</h6>
		<div class="space"></div>

		<button onclick={exportMaterialiousSubs} class="surface-container-highest">
			<i>upload</i>
			<div>{$_('layout.backendEngine.exportToInvidious')}</div>
		</button>

		<div class="space"></div>

		<button onclick={importInvidiousSubs} class="surface-container-highest">
			<i>download</i>
			<div>{$_('layout.backendEngine.importToMaterialious')}</div>
		</button>
	{/if}
{:else}
	<h6>{$_('layout.backendEngine.fallbacks')}</h6>
	{#each engineFallbacks as fallback (fallback)}
		<nav class="no-padding">
			<div class="max">
				<p>{fallback}</p>
			</div>
			<label class="switch" tabindex="0">
				<input
					checked={useEngineFallback(fallback)}
					value={fallback}
					onclick={enableFallback}
					type="checkbox"
					role="switch"
				/>
				<span></span>
			</label>
		</nav>
	{/each}
{/if}
