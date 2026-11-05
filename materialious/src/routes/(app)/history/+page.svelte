<script lang="ts">
	import ItemsList from '#lib/components/layout/ItemsList.svelte';
	import InfiniteLoading, { type InfiniteEvent } from '#lib/components/InfiniteLoading.svelte';
	import { _ } from '#lib/i18n/index';
	import { deleteWatchHistory, getWatchHistory } from '#lib/api/index';

	let { data } = $props();
	let multipleActions = $state(false);

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
	<nav class="right-align history-actions">
		<button
			class="surface-container-highest"
			aria-label="Bulk actions"
			aria-pressed={multipleActions}
			onclick={() => (multipleActions = !multipleActions)}
		>
			<i>checklist</i><span class="m l">Bulk actions</span>
		</button>
		<button onclick={deleteHistory} class="button surface-container-highest">
			<i>clear_all</i>
			<span>{$_('deleteAllHistory')}</span>
		</button>
	</nav>
	<div class="space"></div>
{/if}

<ItemsList
	items={data.videos}
	bind:multipleActions
	showActionButton={false}
/>
<InfiniteLoading on:infinite={loadMore} />

<style>
	.history-actions {
		gap: 0.75rem;
		flex-wrap: wrap;
	}
</style>
