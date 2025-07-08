<script lang="ts">
	import { navigating } from '$app/stores';
	import PageLoading from '$lib/components/PageLoading.svelte';
	import { isTvRouteLoading } from '$lib/store';

	let { children } = $props();
</script>

{#if $isTvRouteLoading || $navigating}
	<PageLoading />
{:else}
	{@render children?.()}
{/if}
