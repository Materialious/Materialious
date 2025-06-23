<script lang="ts">
	import { numberWithCommas } from '$lib/numbers';
	import { _ } from '$lib/i18n';
	import type { VideoPlay } from '$lib/api/model';
	import { onMount } from 'svelte';
	import { expandSummery } from '$lib/misc';
	import { interfaceAutoExpandDesc } from '$lib/store';

	let { video, description }: { video: VideoPlay; description: string } = $props();

	onMount(() => {
		if ($interfaceAutoExpandDesc) {
			expandSummery('description');
		}
	});
</script>

<details>
	<summary id="description" class="bold none">
		<nav>
			<div class="max">
				{numberWithCommas(video.viewCount)}
				{$_('views')} • {video.publishedText}
			</div>
			<i>expand_more</i>
		</nav>
	</summary>
	<div class="space"></div>
	<div class="medium scroll">
		<div style="white-space: pre-line; overflow-wrap: break-word;">
			{@html description}
		</div>
	</div>

	<nav class="scroll">
		{#if video.keywords}
			{#each video.keywords as keyword}
				<a href={`/search/${encodeURIComponent(keyword)}`} class="chip">{keyword}</a>
			{/each}
		{/if}
	</nav>
</details>
