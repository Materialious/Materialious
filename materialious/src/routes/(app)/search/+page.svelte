<script lang="ts">
	import { resolve } from '$app/paths';
	import Search from '$lib/components/Search.svelte';
	import { goToSearch } from '$lib/search';
	import {
		interfaceSearchHistoryEnabled,
		interfaceSearchSuggestionsStore,
		searchHistoryStore
	} from '$lib/store';

	let suggestionsForSearch = $state([]);
</script>

<div class="space"></div>

<div class="search">
	<Search hideSearchSuggestionsAndHistory={true} autoFocus={true} bind:suggestionsForSearch />

	<ul class="list border no-space" style="width: 600px;">
		{#if $interfaceSearchSuggestionsStore}
			{#each suggestionsForSearch as suggestion, index (index)}
				<li>
					<a
						onclick={() => {
							goToSearch(suggestion);
						}}
						href={resolve(`/search/[search]`, { search: encodeURIComponent(suggestion) })}
					>
						<div>{suggestion}</div>
					</a>
				</li>
			{/each}
		{/if}

		{#if !suggestionsForSearch.length && $interfaceSearchHistoryEnabled}
			{#each $searchHistoryStore as history (history)}
				<li>
					<a
						onclick={() => {
							goToSearch(history);
						}}
						href={resolve(`/search/[search]`, { search: encodeURIComponent(history) })}
					>
						<div>{history}</div>
					</a>
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
