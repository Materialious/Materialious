<script lang="ts">
	import { navigating } from '$app/stores';
	import PageLoading from '$lib/components/PageLoading.svelte';
	import { isTvRouteLoading } from '$lib/store';

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

{#if $isTvRouteLoading || $navigating}
	<PageLoading />
{:else}
	{@render children?.()}
{/if}
