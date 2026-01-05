<script lang="ts">
	import { getSearchSuggestions } from '$lib/api';
	import { _ } from '$lib/i18n';
	import { goToSearch } from '$lib/search';
	import {
		interfaceSearchHistoryEnabled,
		interfaceSearchSuggestionsStore,
		searchHistoryStore
	} from '$lib/store';

	let suggestionsForSearch: string[] = $state([]);
	let search = $state('');

	// eslint-disable-next-line no-undef
	let debounceTimer: NodeJS.Timeout;
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
</script>

<div class="space"></div>

<div class="search">
	<div class="field large prefix" style="width: 600px;">
		<i class="front" tabindex="-1">search</i>
		<input
			tabindex="0"
			placeholder={$_('searchPlaceholder')}
			type="text"
			id="search"
			autofocus
			required
			bind:value={search}
			onkeyup={(event) => {
				if (event.key === 'Enter') {
					goToSearch(search);
				} else {
					debouncedSearch(event);
				}
			}}
		/>
	</div>
	<ul class="list border no-space" style="width: 600px;">
		{#if $interfaceSearchSuggestionsStore}
			{#each suggestionsForSearch as suggestion, index (index)}
				<li>
					<button
						tabindex="0"
						onclick={() => {
							goToSearch(suggestion);
						}}
						class="border"
					>
						<div>{suggestion}</div>
					</button>
				</li>
			{/each}
		{/if}

		{#if !suggestionsForSearch.length && $interfaceSearchHistoryEnabled}
			{#each $searchHistoryStore as history (history)}
				<li>
					<button
						tabindex="0"
						onclick={() => {
							goToSearch(history);
						}}
						class="border"
					>
						<div>{history}</div>
					</button>
				</li>
			{/each}
		{/if}
	</ul>
</div>

<style>
	.search {
		display: flex;
		justify-content: center;
		align-items: center;
		flex-direction: column;
	}
</style>
