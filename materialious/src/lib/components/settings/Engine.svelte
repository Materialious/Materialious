<script lang="ts">
	import { isYTBackend } from '$lib/misc';
	import { _ } from '$lib/i18n';
	import { engineCooldownYTStore, engineCullYTStore, engineFallbacksStore } from '$lib/store';
	import { useEngineFallback, type EngineFallback } from '$lib/api/misc';
	import { get } from 'svelte/store';

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
</script>

<article class="error-container">
	<p>{$_('layout.backendEngine.warning')}</p>
</article>

{#if isYTBackend()}
	<h4>Feed</h4>
	<div class="field label prefix border">
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
	<div class="field label prefix border">
		<i>schedule</i>
		<input
			oninput={(event: Event) => {
				engineCooldownYTStore.set(Number((event.target as HTMLInputElement).value));
			}}
			value={$engineCooldownYTStore}
			name="cull"
			type="number"
		/>
		<label for="cull">{$_('layout.backendEngine.cooldown')}</label>
	</div>
{:else}
	<h4>{$_('layout.backendEngine.fallbacks')}</h4>
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
