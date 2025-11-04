<script lang="ts">
	import { goto } from '$app/navigation';
	import Mousetrap from 'mousetrap';
	import { createEventDispatcher, onMount, tick } from 'svelte';
	import { _ } from '$lib/i18n';
	import { getSearchSuggestions } from '../api';
	import {
		interfaceSearchHistoryEnabled,
		interfaceSearchSuggestionsStore,
		isAndroidTvStore,
		searchHistoryStore
	} from '../store';
	import { isVideoID } from '$lib/misc';
	import { resolve } from '$app/paths';

	const dispatch = createEventDispatcher();

	let searchSuggestions = $state(false);
	interfaceSearchSuggestionsStore.subscribe((value) => (searchSuggestions = value));

	let search: string = $state('');
	let suggestionsForSearch: string[] = $state([]);
	let selectedSuggestionIndex: number = $state(-1);

	let showSearchBox = $state(false);

	let debounceTimer: NodeJS.Timeout;
	function debouncedSearch(event: any) {
		if (!searchSuggestions) return;

		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(async () => {
			if (event.target.value === '') {
				suggestionsForSearch = [];
				return;
			}
			suggestionsForSearch = (await getSearchSuggestions(event.target.value)).suggestions;
		}, 250);
	}

	function handleSubmit(event: Event | undefined = undefined) {
		event?.preventDefault();

		const searchTrimed = search.trim();

		if (!searchTrimed) return;

		if (isVideoID(searchTrimed)) {
			// Go directly to video if Video ID provided
			goto(resolve('/watch/[videoId]', { videoId: searchTrimed }));
			return;
		}

		selectedSuggestionIndex = -1;
		goto(`/search/${encodeURIComponent(searchTrimed)}`);

		suggestionsForSearch = [];
		showSearchBox = false;

		if ($interfaceSearchHistoryEnabled && !$searchHistoryStore.includes(searchTrimed)) {
			let pastHistory = $searchHistoryStore;
			if (pastHistory.length > 15) {
				pastHistory.pop();
			}
			searchHistoryStore.set([searchTrimed, ...pastHistory]);
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			event.preventDefault();
			const direction = event.key === 'ArrowUp' ? -1 : 1;
			const container = document.querySelector('.suggestions-container');
			if (container) {
				const children = Array.from(container.children);
				const currentIndex = selectedSuggestionIndex !== -1 ? selectedSuggestionIndex : 0;
				const newIndex = Math.min(Math.max(currentIndex + direction, 0), children.length - 1);
				const selectedItem = children[newIndex];
				if (selectedItem) {
					selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
					selectedSuggestionIndex = newIndex;
				}
			}
		} else if (event.key === 'Enter' && selectedSuggestionIndex !== -1) {
			search = suggestionsForSearch[selectedSuggestionIndex];
			handleSubmit();
		} else if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
			resetSearch();
			event.preventDefault();
		} else if (event.key === 'Escape') {
			resetSearch();
		}
	}

	function resetSearch() {
		search = '';
		suggestionsForSearch = [];
		selectedSuggestionIndex = -1;
		showSearchBox = false;
	}

	onMount(async () => {
		Mousetrap.bind(['ctrl+k', 'command+k'], () => {
			document.getElementById('search-box')?.focus();
			showSearchBox = !showSearchBox;
			if (!showSearchBox) resetSearch();
			return false;
		});
	});
</script>

<form
	onsubmit={handleSubmit}
	onclick={async () => {
		showSearchBox = true;
		await tick();
		document.getElementById('search')?.focus();
	}}
	role="presentation"
>
	<div
		class="field prefix fill no-margin rounded"
		class:search={!$isAndroidTvStore}
		class:search-tv={$isAndroidTvStore}
	>
		<i class="front" tabindex="-1">search</i>
		<input
			tabindex="0"
			id="search-box"
			placeholder={$_('searchPlaceholder')}
			bind:value={search}
			class="rounded"
		/>
		{#if showSearchBox}
			<menu class="min suggestions-container rounded">
				<div class="field large prefix suffix no-margin fixed">
					<i class="front" role="presentation" onclick={() => dispatch('searchCancelled')}
						>arrow_back</i
					>
					<input
						tabindex="0"
						placeholder={$_('searchPlaceholder')}
						type="text"
						id="search"
						required
						bind:value={search}
						onkeydown={handleKeyDown}
						onkeyup={(event) => {
							if (event.key === 'Enter') {
								handleSubmit();
							} else {
								debouncedSearch(event);
							}
						}}
					/>
					<i class="front" role="presentation" onclick={resetSearch}>close</i>
				</div>
				{#if searchSuggestions}
					{#each suggestionsForSearch as suggestion, index}
						<li>
							<a
								onclick={() => {
									search = suggestion;
									handleSubmit();
								}}
								class:selected={index === selectedSuggestionIndex}
								href={`/search/${encodeURIComponent(suggestion)}`}
							>
								<div>{suggestion}</div>
							</a>
						</li>
					{/each}
				{/if}
				{#if !suggestionsForSearch.length && $interfaceSearchHistoryEnabled}
					{#each $searchHistoryStore as history}
						<li>
							<a
								onclick={() => {
									search = history;
								}}
								href={`/search/${encodeURIComponent(history)}`}
							>
								<div>{history}</div>
							</a>
						</li>
					{/each}
				{/if}
			</menu>
		{/if}
	</div>
</form>

<style>
	.search {
		width: 500px;
	}

	.search-tv {
		width: 600px;
	}

	.selected {
		background-color: var(--surface-variant);
	}
	@media screen and (max-width: 1140px) {
		.search {
			width: 100%;
		}
	}
</style>
