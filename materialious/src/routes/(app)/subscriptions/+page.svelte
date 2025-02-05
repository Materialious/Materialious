<script lang="ts">
	import { getFeed } from '$lib/api/index';
	import type { Notification, Video } from '$lib/api/model.js';
	import VideoList from '$lib/components/VideoList.svelte';
	import { activePageStore } from '$lib/store';
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';

	let { data } = $props();

	let currentPage = 1;
	let videos: (Notification | Video)[] = $state([]);

	onMount(() => {
		videos = [...data.feed.notifications, ...data.feed.videos];
	});

	activePageStore.set('subscriptions');

	async function loadMore(event: InfiniteEvent) {
		currentPage++;
		const feed = await getFeed(100, currentPage);
		if (feed.videos.length === 0) {
			event.detail.complete();
		} else {
			videos = [...videos, ...feed.videos, ...feed.notifications];
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

<VideoList {videos} />

<InfiniteLoading on:infinite={loadMore} />
