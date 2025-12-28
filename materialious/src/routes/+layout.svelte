<script lang="ts">
	import { isAndroidTvStore } from '$lib/store';

	let { children } = $props();
</script>

<svelte:head>
	{#if $isAndroidTvStore}
		<style>
			:focus {
				outline: 4px solid var(--primary);
				box-shadow: none !important;
			}
		</style>
	{:else}
		<style>
			:focus {
				outline: none !important;
				box-shadow: none !important;
			}
		</style>
	{/if}
</svelte:head>

{@render children?.()}
