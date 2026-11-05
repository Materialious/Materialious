<script lang="ts">
	import { getFeed } from '#lib/api/index';
	import type { PlaylistPageVideo, Video, VideoBase } from '#lib/api/model';
	import { feedCacheStore, feedLoadingStore } from '#lib/store';
	import InfiniteLoading, { type InfiniteEvent } from '#lib/components/InfiniteLoading.svelte';
	import ItemsList from '#lib/components/layout/ItemsList.svelte';
	import { resolve } from '$app/paths';
	import { _ } from '#lib/i18n/index';
	import PageLoading from '#lib/components/PageLoading.svelte';
	import { isAndroidTv } from '#lib/utils';

	let currentPage = 1;
	let multipleActions = $state(false);
	let videos: (VideoBase | Video | PlaylistPageVideo)[] = $derived($feedCacheStore.subscription);

	async function loadMore(event: InfiniteEvent) {
		currentPage++;

		const feed = await getFeed(100, currentPage);
		if (feed.videos.length === 0) {
			event.detail.complete();
		} else {
			videos = [...videos, ...feed.videos, ...feed.notifications];
			feedCacheStore.set({ subscription: videos });
			event.detail.loaded();
		}
	}
</script>

<nav class="right-align">
	{#if !isAndroidTv()}
		<button class="button surface-container-highest" aria-label="Bulk actions" aria-pressed={multipleActions} onclick={() => (multipleActions = !multipleActions)}>
			<i>checklist</i><span class="m l">Bulk actions</span>
		</button>
	{/if}
	<a class="button surface-container-highest" href={resolve('/(app)/subscriptions/manage')}>
		{$_('subscriptions.manageSubscriptions')}
	</a>
</nav>
<div class="space"></div>

{#if !$feedLoadingStore}
	<ItemsList items={videos ?? []} bind:multipleActions showActionButton={false} />
	<InfiniteLoading on:infinite={loadMore} />
{:else}
	<PageLoading />
{/if}
