<script lang="ts">
	import { goto } from '$app/navigation';
	import Mousetrap from 'mousetrap';
	import { createEventDispatcher, onMount, tick } from 'svelte';
	import { _ } from '$lib/i18n';
	import { getSearchSuggestions } from '../api';
	import {
		interfaceSearchHistoryEnabled,
		interfaceSearchSuggestionsStore,
		searchHistoryStore
	} from '../store';
	import androidTv from '$lib/android/plugins/androidTv';

	const dispatch = createEventDispatcher();

	let searchSuggestions = $state(false);
	interfaceSearchSuggestionsStore.subscribe((value) => (searchSuggestions = value));

	let search: string = $state('');
	let suggestionsForSearch: string[] = $state([]);
	let selectedSuggestionIndex: number = $state(-1);

	let showSearchBox = $state(false);

	let isAndroidTv = $state(false);

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
		if (event) event.preventDefault();

		if (search.trim() === '') return;

		selectedSuggestionIndex = -1;
		goto(`/search/${encodeURIComponent(search)}`);

		suggestionsForSearch = [];
		showSearchBox = false;

		if ($interfaceSearchHistoryEnabled && !$searchHistoryStore.includes(search)) {
			let pastHistory = $searchHistoryStore;
			if (pastHistory.length > 15) {
				pastHistory.pop();
			}
			searchHistoryStore.set([search, ...pastHistory]);
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
		isAndroidTv = await androidTv.isAndroidTv();
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
	tabindex="0"
	role="presentation"
>
	<div
		class="field prefix fill no-margin rounded"
		class:search={!isAndroidTv}
		class:search-tv={isAndroidTv}
	>
		<i class="front" tabindex="-1">search</i>
		<input
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
						<a
							onclick={() => {
								search = suggestion;
								handleSubmit();
							}}
							class="row"
							class:selected={index === selectedSuggestionIndex}
							href={`/search/${encodeURIComponent(suggestion)}`}
						>
							<div>{suggestion}</div>
						</a>
					{/each}
				{/if}
				{#if !suggestionsForSearch.length && $interfaceSearchHistoryEnabled}
					{#each $searchHistoryStore as history}
						<a
							class="row"
							onclick={() => {
								search = history;
							}}
							href={`/search/${encodeURIComponent(history)}`}
						>
							<div>{history}</div>
						</a>
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
