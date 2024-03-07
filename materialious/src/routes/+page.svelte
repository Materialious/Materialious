<script lang="ts">
	import PageLoading from '$lib/PageLoading.svelte';
	import Thumbnail from '$lib/Thumbnail.svelte';

	export let data;
</script>

{#if data.trending}
	<div class="page right active">
		<div class="space"></div>
		<div class="grid">
			{#each data.trending as video}
				<div class="s12 m6 l2">
					<Thumbnail {video} />
				</div>
			{/each}
		</div>
	</div>
{:else}
	<PageLoading />
{/if}
