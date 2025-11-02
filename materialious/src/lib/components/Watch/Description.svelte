<script lang="ts">
	import { resolve } from '$app/paths';
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
		</nav>
	</summary>
	<div class="space"></div>
	<div class="medium scroll">
		<div style="white-space: pre-line; overflow-wrap: break-word;">
			{@html description}
		</div>

		{#if video.keywords}
			<article class="border">
				<nav class="scroll">
					{#each video.keywords as keyword}
						<a href={resolve(`/search/${encodeURIComponent(keyword)}`)} class="chip">{keyword}</a>
					{/each}
				</nav>
			</article>
		{/if}
	</div>
</details>
