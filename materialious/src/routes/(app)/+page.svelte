<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ItemsList from '$lib/components/layout/ItemsList.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import Search from '$lib/components/Search.svelte';
	import {
		feedCacheStore,
		hideSearchStore,
		invidiousAuthStore,
		isAndroidTvStore
	} from '$lib/store';
	import { onDestroy, onMount } from 'svelte';
	import { get } from 'svelte/store';

	let { data } = $props();

	onMount(() => {
		if (data.popularDisabled) {
			if ($isAndroidTvStore) {
				if (get(invidiousAuthStore)) {
					goto(resolve('/subscriptions', {}), { replaceState: true });
					return;
				}
				goto(resolve('/search', {}), { replaceState: true });
				return;
			}
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
