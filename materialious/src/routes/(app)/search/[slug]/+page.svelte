<script lang="ts">
	import { getSearch } from '$lib/api';
	import PageLoading from '$lib/components/PageLoading.svelte';
	import { searchCacheStore } from '$lib/store';
	import { _ } from '$lib/i18n';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import ItemsList from '$lib/components/ItemsList.svelte';
	import type { SearchOptions } from '$lib/api/model.js';

	let { data } = $props();

	let currentPage = 1;

	let filtersOpen = $state(false);

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
			options: ['hour', 'today', 'week', 'month', 'year'],
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
		currentPage++;
		searchOptions = {
			...searchOptions,
			page: currentPage.toString()
		};
		const newSearch = await getSearch(data.slug, searchOptions);

		if (newSearch.length === 0) {
			event.detail.complete();
		} else {
			searchCacheStore.set({
				[data.searchStoreId]: [...($searchCacheStore[data.searchStoreId] ?? []), ...newSearch]
			});
			event.detail.loaded();
		}
	}
</script>

<details open={filtersOpen}>
	<summary>
		<nav>
			<button
				class="secondary"
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

<div class="space"></div>

{#if $searchCacheStore[data.searchStoreId]}
	<ItemsList items={$searchCacheStore[data.searchStoreId]} />
{:else}
	<PageLoading />
{/if}

<InfiniteLoading on:infinite={loadMore} />
