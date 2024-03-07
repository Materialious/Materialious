<script lang="ts">
	import { getTrending } from '$lib/Api';
	import type { Video } from '$lib/Api/model';
	import PageLoading from '$lib/PageLoading.svelte';
	import Thumbnail from '$lib/Thumbnail.svelte';
	import { onMount } from 'svelte';

	let trending: Video[];

	onMount(async () => {
		trending = await getTrending();
	});
</script>

{#if trending}
	<div class="page right active">
		<div class="space"></div>
		<div class="grid">
			{#each trending as video}
				<div class="s12 m6 l2">
					<Thumbnail {video} />
				</div>
			{/each}
		</div>
	</div>
{:else}
	<PageLoading />
{/if}
