<script lang="ts">
	import { getHashtag } from '$lib/api';
	import type { Video } from '$lib/api/model';
	import ItemsList from '$lib/components/layout/ItemsList.svelte';
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

<ItemsList items={videos} />

<InfiniteLoading on:infinite={loadMore} />
