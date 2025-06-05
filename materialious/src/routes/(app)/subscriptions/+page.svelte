<script lang="ts">
	import { getFeed } from '$lib/api/index';
	import type { PlaylistPageVideo, Video, VideoBase } from '$lib/api/model.js';
	import VideoList from '$lib/components/VideoList.svelte';
	import { feedCacheStore } from '$lib/store';
	import { _ } from '$lib/i18n';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';

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

<div class="space"></div>
<nav class="right-align">
	<a class="button" href="/subscriptions/manage">
		<i>subscriptions</i>
		<span>{$_('subscriptions.manageSubscriptions')}</span>
	</a>
</nav>

<VideoList videos={videos ?? []} />

<InfiniteLoading on:infinite={loadMore} />
