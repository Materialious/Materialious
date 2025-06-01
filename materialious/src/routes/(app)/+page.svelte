<script lang="ts">
	import VideoList from '$lib/components/VideoList.svelte';
	import { feedCacheStore } from '$lib/store.js';

	let { data } = $props();
</script>

{#if data.popularDisabled}
	<div class="space"></div>

	<nav class="center-align">
		<p>Popular page has been disabled</p>
	</nav>
{:else}
	<VideoList videos={$feedCacheStore.popular ?? []} />
{/if}
