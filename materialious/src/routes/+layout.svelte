<script lang="ts">
	import { isAndroidTvStore } from '$lib/store';
	import { App } from '@capacitor/app';
	import '$lib/fetchProxy';

	let { children } = $props();

	App.addListener('backButton', async (data) => {
		if (data.canGoBack) {
			window.history.back();
		} else {
			await App.exitApp();
		}
	});
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
