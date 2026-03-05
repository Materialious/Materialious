<script lang="ts">
	import { navigating } from '$app/state';
	import PageLoading from '$lib/components/PageLoading.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<style>
		:focus {
			outline: 4px solid var(--primary);
			box-shadow: none !important;
		}
	</style>
</svelte:head>

{#await navigating.complete}
	<PageLoading />
	<!-- eslint-disable-next-line  @typescript-eslint/no-unused-vars -->
{:then _}
	{@render children?.()}
{/await}
