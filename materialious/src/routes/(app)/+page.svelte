<script lang="ts">
	import ItemsList from '$lib/components/layout/ItemsList.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import Search from '$lib/components/Search.svelte';
	import { feedCacheStore, hideSearchStore } from '$lib/store';
	import { onDestroy, onMount } from 'svelte';

	let { data } = $props();

	onMount(() => {
		if (data.popularDisabled) {
			hideSearchStore.set(true);
		}
	});

	onDestroy(() => {
		hideSearchStore.set(false);
	});
</script>

{#if data.popularDisabled}
	<div class="center">
		<div class="space"></div>
		<Logo size="200px" />
		<h1>Materialious</h1>
		<Search />
	</div>
{:else}
	<ItemsList items={$feedCacheStore.popular ?? []} />
{/if}

<style>
	.center {
		height: 50%;
		display: flex;
		justify-content: center;
		align-items: center;
		flex-direction: column;
	}
</style>
