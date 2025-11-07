<script lang="ts">
	import { navigating } from '$app/stores';
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

{#if $navigating}
	<PageLoading />
{:else}
	{@render children?.()}
{/if}
