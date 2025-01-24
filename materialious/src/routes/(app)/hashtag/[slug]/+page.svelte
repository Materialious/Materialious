<script lang="ts">
	import { getHashtag } from '$lib/api';
	import VideoList from '$lib/components/VideoList.svelte';
	import { activePageStore } from '$lib/store';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';

	export let data;

	let currentPage = 1;
	$: videos = [...data.hashTagVideos.results];

	activePageStore.set('hashtag');

	async function loadMore(event: InfiniteEvent) {
		currentPage++;
		const hashtagVideos = (await getHashtag(data.hashtag, currentPage)).results;
		if (hashtagVideos.length === 0) {
			event.detail.complete();
		} else {
			videos = [...videos, ...hashtagVideos];
			event.detail.loaded();
		}
	}
</script>

<VideoList {videos} />

<InfiniteLoading on:infinite={loadMore} />
