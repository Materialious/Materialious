<script lang="ts">
	import { goto } from '$app/navigation';
	import { _ } from 'svelte-i18n';
	import { interfaceSearchSuggestions } from '../store';
	import { getSearchSuggestions } from './Api';

	let searchSuggestions = false;
	interfaceSearchSuggestions.subscribe((value) => (searchSuggestions = value));

	let search: string;
	let suggestionsForSearch: string[] = [];
	let selectedSuggestionIndex: number = -1;

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
		selectedSuggestionIndex = -1;
		goto(`/search/${encodeURIComponent(search)}`);
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			selectedSuggestionIndex = Math.min(
				selectedSuggestionIndex + 1,
				suggestionsForSearch.length - 1
			);
		} else if (event.key === 'Enter' && selectedSuggestionIndex !== -1) {
			search = suggestionsForSearch[selectedSuggestionIndex];
			handleSubmit();
		}
	}
</script>

<form on:submit|preventDefault={handleSubmit}>
	<div class="field prefix round fill no-margin search">
		<i class="front">search</i>
		<input bind:value={search} on:click={() => document.getElementById('search')?.focus()} />
		<menu class="min">
			<div class="field large prefix suffix no-margin fixed">
				<i class="front">arrow_back</i>
				<input
					placeholder={$_('searchPlaceholder')}
					type="text"
					id="search"
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
				<i class="front" on:click={() => (search = '')}>close</i>
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
