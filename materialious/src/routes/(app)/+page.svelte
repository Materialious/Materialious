<script lang="ts">
	import ItemsList from '$lib/components/layout/ItemsList.svelte';
	import { _ } from '$lib/i18n/index';
	import { feedCacheStore } from '$lib/store';

	let { data } = $props();
</script>

{#if data.popularDisabled}
	<div class="center-align">
		<div class="space"></div>
		<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24"
			><path
				style="fill: var(--secondary);"
				d="M11.25 21.975Q9.3 21.825 7.612 21t-2.937-2.162q-1.25-1.338-1.963-3.1T2 12q0-2.075.788-3.9t2.137-3.175q1.35-1.35 3.175-2.137T12 2q2.075 0 3.9.788t3.175 2.137q1.35 1.35 2.138 3.175T22 12v.475q-.425-.275-.988-.537t-1.037-.438q-.2-3.15-2.488-5.325T12 4q-1.4 0-2.638.45T7.1 5.7l6.125 6.125q-.475.2-.912.463t-.863.562L5.7 7.1q-.8 1.025-1.25 2.263T4 12q0 2.475 1.338 4.438T8.8 19.325q.45.7 1.125 1.425t1.325 1.225ZM17 20q1.475 0 2.738-.675T21.75 17.5q-.75-1.15-2.013-1.825T17 15q-1.475 0-2.738.675T12.25 17.5q.75 1.15 2.013 1.825T17 20Zm0 2q-2.4 0-4.288-1.263T10 17.5q.825-1.975 2.713-3.238T17 13q2.4 0 4.288 1.263T24 17.5q-.825 1.975-2.713 3.238T17 22Zm0-3q-.625 0-1.063-.438T15.5 17.5q0-.625.438-1.063T17 16q.625 0 1.063.438T18.5 17.5q0 .625-.438 1.063T17 19Z"
			/></svg
		>
		<h1>{$_('disabled')}</h1>
		<p>{$_('popularPageDisabled')}</p>
	</div>
{:else}
	<ItemsList items={$feedCacheStore.popular ?? []} />
{/if}
