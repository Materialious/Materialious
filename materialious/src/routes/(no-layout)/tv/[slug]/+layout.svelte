<script lang="ts">
	import PageLoading from '$lib/components/PageLoading.svelte';
	import { isTvRouteLoading } from '$lib/store';

	let { children } = $props();
</script>

{#if $isTvRouteLoading}
	<PageLoading />
{:else}
	{@render children?.()}
{/if}
