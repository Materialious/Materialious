<script lang="ts">
	import { getFeed } from '$lib/api/index';
	import type { PlaylistPageVideo, Video, VideoBase } from '$lib/api/model';
	import { feedCacheStore, feedLoadingStore } from '$lib/store';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import ItemsList from '$lib/components/ItemsList.svelte';
	import { resolve } from '$app/paths';
	import { _ } from '$lib/i18n';
	import PageLoading from '$lib/components/PageLoading.svelte';

	let currentPage = 1;
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
	<a class="button surface-container-highest" href={resolve('/subscriptions/manage', {})}>
		{$_('subscriptions.manageSubscriptions')}
	</a>
</nav>
<div class="space"></div>

{#if !$feedLoadingStore}
	<ItemsList items={videos ?? []} />
	<InfiniteLoading on:infinite={loadMore} />
{:else}
	<PageLoading />
{/if}
