<script lang="ts">
	import ItemsList from '$lib/components/layout/ItemsList.svelte';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import { _ } from '$lib/i18n';
	import { deleteWatchHistory, getWatchHistory } from '$lib/api/index.js';

	let { data } = $props();

	let currentPage = 1;
	async function loadMore(event: InfiniteEvent) {
		currentPage++;

		const history = await getWatchHistory({ page: currentPage });
		if (history.length === 0) {
			event.detail.complete();
		} else {
			data.videos = [...data.videos, ...history];
			event.detail.loaded();
		}
	}

	async function deleteHistory() {
		await deleteWatchHistory();
		data.videos = [];
	}
</script>

{#if data.videos.length > 0}
	<nav class="right-align">
		<button onclick={deleteHistory} class="button surface-container-highest">
			<i>clear_all</i>
			<span>{$_('deleteAllHistory')}</span>
		</button>
	</nav>
	<div class="space"></div>
{/if}

<ItemsList items={data.videos} />
<InfiniteLoading on:infinite={loadMore} />
