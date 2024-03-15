<script lang="ts">
	import { getHistory, getVideo } from '$lib/Api';
	import type { VideoPlay } from '$lib/Api/model';
	import PageLoading from '$lib/PageLoading.svelte';
	import Thumbnail from '$lib/Thumbnail.svelte';
	import { onMount } from 'svelte';
	import { activePage } from '../../store';

	activePage.set('history');

	let history: VideoPlay[] = [];
	let loaded = false;

	async function loadPageHistory(page: number = 1) {
		const videoIds = await getHistory(page);
		let promises = [];
		for (const videoId of videoIds) {
			promises.push(getVideo(videoId));
		}
		history = [...history, ...(await Promise.all(promises))];
	}

	onMount(async () => {
		await loadPageHistory();
		loaded = true;
	});
</script>

{#if loaded}
	<div class="page right active">
		<div class="space"></div>
		<div class="grid">
			{#each history as video}
				<div class="s12 m6 l2">
					<Thumbnail {video} />
				</div>
			{/each}
		</div>
	</div>
{:else}
	<PageLoading />
{/if}
