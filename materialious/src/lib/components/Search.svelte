<script lang="ts">
	import { goto } from '$app/navigation';
	import Mousetrap from 'mousetrap';
	import { createEventDispatcher, onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { getSearchSuggestions } from '../api';
	import { interfaceSearchSuggestionsStore } from '../store';

	const dispatch = createEventDispatcher();

	let searchSuggestions = false;
	interfaceSearchSuggestionsStore.subscribe((value) => (searchSuggestions = value));

	let search: string;
	let suggestionsForSearch: string[] = [];
	let selectedSuggestionIndex: number = -1;

	let showSearchBox = false;

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

	function handleSubmit() {
		if (search.trim() === '') return;

		selectedSuggestionIndex = -1;
		goto(`/search/${encodeURIComponent(search)}`);
		dispatch('searchSubmitted');

		showSearchBox = false;
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

	onMount(() => {
		Mousetrap.bind(['ctrl+k', 'command+k'], () => {
			document.getElementById('search-box')?.focus();
			showSearchBox = !showSearchBox;
			if (!showSearchBox) resetSearch();
			return false;
		});
	});
</script>

<form on:submit|preventDefault={handleSubmit}>
	<div class="field prefix round fill no-margin search">
		<i class="front">search</i>
		<input
			id="search-box"
			placeholder={$_('searchPlaceholder')}
			bind:value={search}
			on:click={async () => {
				showSearchBox = true;
			}}
		/>
		{#if showSearchBox}
			<menu class="min suggestions-container">
				<div class="field large prefix suffix no-margin fixed">
					<i class="front" on:click={() => dispatch('searchCancelled')}>arrow_back</i>
					<input
						placeholder={$_('searchPlaceholder')}
						type="text"
						autofocus
						required
						bind:value={search}
						on:keydown={handleKeyDown}
						on:keyup={(event) => {
							if (event.key === 'Enter') {
								handleSubmit();
							} else {
								debouncedSearch(event);
							}
						}}
					/>
					<i class="front" on:click={resetSearch}>close</i>
				</div>
				{#if searchSuggestions}
					{#each suggestionsForSearch as suggestion, index}
						<a
							on:click={() => {
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
			</menu>
		{/if}
	</div>
</form>

<style>
	.search {
		width: 500px;
	}
	@media screen and (max-width: 1140px) {
		.search {
			width: 100%;
		}
	}
	.selected {
		background-color: var(--surface-variant);
	}
</style>
