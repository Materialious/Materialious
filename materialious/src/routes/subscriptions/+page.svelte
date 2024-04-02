<script lang="ts">
	import { getFeed } from '$lib/Api/index.js';
	import VideoList from '$lib/VideoList.svelte';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import { activePage } from '../../store';

	export let data;

	let currentPage = 1;
	$: videos = [...data.feed.videos, ...data.feed.notifications];

	activePage.set('subscriptions');

	async function loadMore(event: InfiniteEvent) {
		currentPage++;
		const feed = await getFeed(100, currentPage);
		if (feed.notifications.length === 0) {
			event.detail.complete();
		} else {
			videos = [...videos, ...feed.notifications];
			event.detail.loaded();
		}
	}
</script>

<VideoList bind:videos />

<InfiniteLoading on:infinite={loadMore} />
