<script lang="ts">
	import { getFeed } from '$lib/api/index';
	import { activePageStore } from '$lib/store';
	import VideoList from '$lib/VideoList.svelte';
	import { _ } from 'svelte-i18n';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';

	export let data;

	let currentPage = 1;
	$: videos = [...data.feed.notifications, ...data.feed.videos];

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

<VideoList bind:videos />

<InfiniteLoading on:infinite={loadMore} />
