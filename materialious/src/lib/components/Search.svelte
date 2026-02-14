<script lang="ts">
	import Mousetrap from 'mousetrap';
	import { createEventDispatcher, onMount, tick } from 'svelte';
	import { _ } from '$lib/i18n';
	import { getSearchSuggestions } from '../api';
	import {
		interfaceSearchHistoryEnabled,
		interfaceSearchSuggestionsStore,
		searchHistoryStore
	} from '../store';
	import { goToSearch } from '$lib/search';

	let {
		autoFocus = false,
		suggestionsForSearch = $bindable([])
	}: {
		autoFocus?: boolean;
		suggestionsForSearch?: string[];
	} = $props();

	const dispatch = createEventDispatcher();
	let search: string = $state('');
	let selectedSuggestionIndex: number = $state(-1);

	let showSearchBox = $state(false);

	let debounceTimer: ReturnType<typeof setTimeout>;
	function debouncedSearch(event: any) {
		if (!$interfaceSearchSuggestionsStore) return;

		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(async () => {
			if (event.target.value === '') {
				suggestionsForSearch = [];
				return;
			}
			suggestionsForSearch = (await getSearchSuggestions(event.target.value)).suggestions;
		}, 250);
	}

	function onSubmit(event: Event | undefined = undefined) {
		clearTimeout(debounceTimer);
		event?.preventDefault();

		goToSearch(search);

		selectedSuggestionIndex = -1;
		suggestionsForSearch = [];
		showSearchBox = false;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			event.preventDefault();

			const direction = event.key === 'ArrowUp' ? -1 : 1;
			const container = document.querySelector('.suggestions-container');
			if (container) {
				// Filter to ensure only list items are used.
				const children = Array.from(container.children).filter((child) => {
					return child.tagName === 'LI';
				});
				let currentIndex = selectedSuggestionIndex;

				if (selectedSuggestionIndex !== -1) {
					children[currentIndex].classList.remove('primary-border');
				}

				const newIndex = Math.min(Math.max(currentIndex + direction, 0), children.length - 1);
				const selectedItem = children[newIndex];
				if (selectedItem) {
					selectedItem.classList.add('primary-border');
					selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
					selectedSuggestionIndex = newIndex;
				}
			}
		} else if (event.key === 'Enter' && selectedSuggestionIndex !== -1) {
			event.preventDefault();

			search = suggestionsForSearch[selectedSuggestionIndex];
			onSubmit();
		} else if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
			event.preventDefault();

			resetSearch();
			event.preventDefault();
		} else if (event.key === 'Escape') {
			event.preventDefault();

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

		if (autoFocus) {
			showSearchBox = true;
			await tick();
			document.getElementById('search')?.focus();
		}
	});
</script>

<form
	onsubmit={onSubmit}
	onclick={async () => {
		showSearchBox = true;
		await tick();
		document.getElementById('search')?.focus();
	}}
	role="presentation"
>
	<div class="field prefix fill no-margin rounded search">
		<i class="front" tabindex="-1">search</i>
		<input
			tabindex="0"
			id="search-box"
			placeholder={$_('searchPlaceholder')}
			bind:value={search}
			class="rounded"
		/>
		{#if showSearchBox}
			<menu class="min rounded suggestions-container">
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
							event.preventDefault();
							if (event.key === 'Enter') {
								onSubmit();
							} else {
								debouncedSearch(event);
							}
						}}
					/>
					<i class="front" role="presentation" onclick={resetSearch}>close</i>
				</div>
				{#if $interfaceSearchSuggestionsStore}
					{#each suggestionsForSearch as suggestion, index (index)}
						<li class="no-padding">
							<button
								onclick={() => {
									search = suggestion;
									onSubmit();
								}}
								type="reset"
								class="transparent suggestion"
								class:selected={index === selectedSuggestionIndex}
							>
								<div>{suggestion}</div>
							</button>
						</li>
					{/each}
				{/if}
				{#if !suggestionsForSearch.length && $interfaceSearchHistoryEnabled}
					{#each $searchHistoryStore as history (history)}
						<li class="no-padding">
							<button
								onclick={() => {
									search = history;
								}}
								type="reset"
								class="transparent suggestion"
							>
								<div>{history}</div>
							</button>
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

	.selected {
		background-color: var(--surface-variant);
	}

	button.suggestion {
		width: 100%;
		box-sizing: content-box;
		justify-content: flex-start;
	}

	li:hover {
		background-color: transparent;
	}

	@media screen and (max-width: 1140px) {
		.search {
			width: 100%;
		}
	}
</style>
