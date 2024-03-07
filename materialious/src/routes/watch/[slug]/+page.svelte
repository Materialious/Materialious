<script lang="ts">
	import { page } from '$app/stores';
	import { getVideo } from '$lib/Api';
	import type { VideoPlay } from '$lib/Api/model';
	import PageLoading from '$lib/PageLoading.svelte';
	import Thumbnail from '$lib/Thumbnail.svelte';
	import { onMount } from 'svelte';

	let video: VideoPlay;

	onMount(async () => {
		video = await getVideo($page.params.slug);
	});
</script>

{#if video}
	<div class="grid large-margin">
		<div class="s12 m10 l10">
			<h5>{video.title}</h5>
			<p style="white-space: pre-line">{video.description}</p>
		</div>
		<div class="m4 l2">
			{#each video.recommendedVideos as recommendedVideo}
				<Thumbnail video={recommendedVideo} />
			{/each}
		</div>
	</div>
{:else}
	<PageLoading />
{/if}
