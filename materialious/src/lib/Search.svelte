<script lang="ts">
	import { goto } from '$app/navigation';
	import { interfaceSearchSuggestions } from '../store';
	import { getSearchSuggestions } from './Api';

	let searchSuggestions = false;
	interfaceSearchSuggestions.subscribe((value) => (searchSuggestions = value));

	let search: string;
	let suggestionsForSearch: string[] = [];

	let debounceTimer: NodeJS.Timeout;
	const debouncedSearch = (event: any) => {
		if (!searchSuggestions) return;

		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(async () => {
			if (event.target.value === '') {
				suggestionsForSearch = [];
				return;
			}
			suggestionsForSearch = (await getSearchSuggestions(event.target.value)).suggestions;
		}, 250);
	};
</script>

<form on:submit|preventDefault={() => goto(`/search/${encodeURIComponent(search)}`)}>
	<div class="max field round suffix prefix small no-margin white black-text">
		<i class="front">search</i><input
			data-ui="search-suggestions"
			type="text"
			placeholder="Search..."
			bind:value={search}
			on:keyup={(target) => debouncedSearch(target)}
		/>
		{#if searchSuggestions}
			<menu
				class="no-wrap"
				style="width: 100%;"
				id="search-suggestions"
				data-ui="#search-suggestions"
			>
				{#each suggestionsForSearch as suggestion}
					<a href={`/search/${encodeURIComponent(suggestion)}`}>{suggestion}</a>
				{/each}
			</menu>
		{/if}
	</div>
</form>
