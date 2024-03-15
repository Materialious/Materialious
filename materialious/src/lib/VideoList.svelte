<script lang="ts">
	import type { Video, VideoBase } from './Api/model';
	import PageLoading from './PageLoading.svelte';
	import Thumbnail from './Thumbnail.svelte';

	export let videos: VideoBase[] | Video[] | Notification[] = [];
</script>

{#if videos.length > 0}
	<div class="page right active">
		<div class="space"></div>
		<div class="grid">
			{#each videos as video}
				<div class="s12 m6 l2">
					<article class="no-padding" style="height: 100%;">
						<Thumbnail {video} />
					</article>
				</div>
			{/each}
		</div>
	</div>
{:else}
	<PageLoading />
{/if}
