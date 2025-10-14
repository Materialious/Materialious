<script lang="ts">
	import ItemsList from '$lib/components/ItemsList.svelte';
	import { feedCacheStore } from '$lib/store';

	let { data } = $props();
</script>

{#if data.popularDisabled}
	<nav class="center-align">
		<p>Popular page has been disabled</p>
	</nav>
{:else}
	<ItemsList items={$feedCacheStore.popular ?? []} />
{/if}
