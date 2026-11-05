<script lang="ts">
	import { getSearch } from '#lib/api/index';
	import PageLoading from '#lib/components/PageLoading.svelte';
	import { searchCacheStore } from '#lib/store';
	import { _ } from '#lib/i18n/index';
	import InfiniteLoading, { type InfiniteEvent } from '#lib/components/InfiniteLoading.svelte';
	import ItemsList from '#lib/components/layout/ItemsList.svelte';
	import type { SearchOptions, SearchResults } from '#lib/api/model';
	import { isAndroidTv } from '#lib/utils';

	let { data } = $props();

	let currentPage = 1;

	let filtersOpen = $state(false);
	let multipleActions = $state(false);

	let searchOptions: SearchOptions = $state({
		type: 'all',
		page: currentPage.toString(),
		sort_by: 'relevance'
	});

	const filters: {
		options: string[];
		title: string;
		key: 'type' | 'date' | 'duration' | 'sort_by' | 'features';
	}[] = $state([
		{
			options: ['all', 'video', 'playlist', 'channel'],
			title: $_('filters.type'),
			key: 'type'
		},
		{
			options: ['today', 'week', 'month', 'year'],
			title: $_('filters.uploadDate'),
			key: 'date'
		},
		{
			options: ['short', 'medium', 'long'],
			title: $_('filters.duration'),
			key: 'duration'
		},
		{
			options: ['relevance', 'rating', 'upload_date', 'view_count'],
			title: $_('filters.sortBy'),
			key: 'sort_by'
		},
		{
			options: [
				'hd',
				'subtitles',
				'creative_commons',
				'3d',
				'live',
				'purchased',
				'4k',
				'360',
				'location',
				'hdr',
				'vr180'
			],
			title: $_('filters.features'),
			key: 'features'
		}
	]);

	async function updateSearch() {
		data.searchStoreId = JSON.stringify(searchOptions) + data.slug;
		searchCacheStore.set({ [data.searchStoreId]: await getSearch(data.slug, searchOptions) });
	}

	async function loadMore(event: InfiniteEvent) {
		let newSearch: SearchResults;

		const searchCacheItem = $searchCacheStore[data.searchStoreId];

		if (searchCacheItem.getContinuation) {
			newSearch = await searchCacheItem.getContinuation();

			if (newSearch.getContinuation) {
				searchCacheItem.getContinuation = newSearch.getContinuation;
			}
		} else {
			currentPage++;
			searchOptions = {
				...searchOptions,
				page: currentPage.toString()
			};

			newSearch = await getSearch(data.slug, searchOptions);
		}

		if (newSearch.length === 0) {
			event.detail.complete();
		} else {
			searchCacheStore.set({
				[data.searchStoreId]: [...(searchCacheItem ?? []), ...newSearch]
			});
		}
	}
</script>

<nav class="search-actions">
	<details open={filtersOpen}>
	<summary>
		<nav>
			<button
				class="surface-container-highest"
				onclick={() => {
					filtersOpen = !filtersOpen;
				}}
			>
				<i>filter_alt</i>
				<span>{$_('filters.filters')}</span>
			</button>
		</nav>
	</summary>
	<article class="scroll medium">
		<div class="grid">
			{#each filters as filter (filter)}
				<div class="s12 m2 l2">
					<h6>{filter.title}</h6>
					<ul class="list no-margin no-padding">
						{#each filter.options as filterOption (filterOption)}
							<li>
								<button
									class="small border"
									style="text-transform: capitalize;"
									disabled={filter.key !== 'type' &&
										!['all', 'video', undefined].includes(searchOptions.type)}
									class:active={filterOption === searchOptions[filter.key]}
									onclick={async () => {
										if (filterOption === searchOptions[filter.key]) {
											delete searchOptions[filter.key];
										} else {
											searchOptions = {
												...searchOptions,
												[filter.key]: filterOption
											};
										}
										await updateSearch();
									}}
								>
									<span>{filterOption.replaceAll('_', ' ')}</span>
								</button>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	</article>
	</details>
	{#if !isAndroidTv()}
	<button
		class="surface-container-highest"
		aria-label="Bulk actions"
		aria-pressed={multipleActions}
		onclick={() => (multipleActions = !multipleActions)}
	>
		<i>checklist</i>
		<span class="m l">Bulk actions</span>
	</button>
	{/if}
</nav>

<div class="space"></div>

{#if $searchCacheStore[data.searchStoreId]}
	<ItemsList items={$searchCacheStore[data.searchStoreId]} bind:multipleActions showActionButton={false} />
{:else}
	<PageLoading />
{/if}

<InfiniteLoading on:infinite={loadMore} />

<style>
	.search-actions {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.search-actions details {
		flex: 1;
		min-width: 0;
	}
</style>
