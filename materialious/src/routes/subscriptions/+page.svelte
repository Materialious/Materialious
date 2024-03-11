<script lang="ts">
	import PageLoading from '$lib/PageLoading.svelte';
	import Thumbnail from '$lib/Thumbnail.svelte';
	import { activePage } from '../../store.js';

	export let data;

	activePage.set('subscriptions');
</script>

{#if data}
	<div class="page right active">
		<div class="space"></div>
		<div class="grid">
			{#each data.feed.videos as video}
				<div class="s12 m6 l2">
					<Thumbnail {video} />
				</div>
			{/each}
		</div>
	</div>
{:else}
	<PageLoading />
{/if}
