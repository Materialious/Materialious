<script lang="ts">
	import { get } from 'svelte/store';
	import { activePage } from '../store';
	import type { Video, VideoBase } from './Api/model';
	import PageLoading from './PageLoading.svelte';
	import Thumbnail from './Thumbnail.svelte';

	export let videos: VideoBase[] | Video[] | Notification[] = [];
</script>

<h2>{get(activePage)}</h2>

<div class="divider"></div>

{#if videos.length > 0}
	<div class="page right active">
		<div class="space"></div>
		<div class="grid">
			{#each videos as video}
				<div class="s12 m6 l2">
					<Thumbnail {video} />
				</div>
			{/each}
		</div>
	</div>
{:else}
	<PageLoading />
{/if}

<style>
	h2 {
		color: var(--secondary-text);
		padding: 0.2em;
		text-transform: capitalize;
		display: flex;
		justify-content: center;
	}
</style>
