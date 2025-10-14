<script lang="ts">
	import { getFeed } from '$lib/api/index';
	import type { PlaylistPageVideo, Video, VideoBase } from '$lib/api/model.js';
	import { feedCacheStore } from '$lib/store';
	import { _ } from '$lib/i18n';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import ItemsList from '$lib/components/ItemsList.svelte';

	let currentPage = 1;
	let videos: (VideoBase | Video | PlaylistPageVideo)[] = $state($feedCacheStore.subscription);

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

<ItemsList items={videos ?? []} />

<InfiniteLoading on:infinite={loadMore} />
