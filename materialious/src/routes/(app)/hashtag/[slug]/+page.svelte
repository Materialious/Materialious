<script lang="ts">
	import { run } from 'svelte/legacy';

	import { getHashtag } from '$lib/api';
	import VideoList from '$lib/components/VideoList.svelte';
	import { activePageStore } from '$lib/store';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';

	let { data } = $props();

	let currentPage = 1;
	let videos;
	run(() => {
		videos = [...data.hashTagVideos.results];
	});

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
