<script lang="ts">
	import { getHashtag } from '$lib/api';
	import type { Video } from '$lib/api/model.js';
	import VideoList from '$lib/components/VideoList.svelte';
	import { onMount } from 'svelte';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';

	let { data } = $props();

	let currentPage = 1;
	let videos: Video[] = $state([]);

	onMount(() => {
		videos = [...data.hashTagVideos.results];
	});

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
