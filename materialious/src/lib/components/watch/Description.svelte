<script lang="ts">
	import { cleanNumber } from '$lib/numbers';
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
				{cleanNumber(video.viewCount)}
				{$_('views')} • {video.publishedText}
			</div>
		</nav>
	</summary>
	<div class="space"></div>
	<div class="medium scroll">
		<div style="white-space: pre-line; overflow-wrap: break-word;">
			{@html description}
		</div>

		{#if video.keywords && video.keywords.length > 0}
			<article class="border">
				<nav class="scroll">
					{#each video.keywords as keyword}
						<a href={`/search/${encodeURIComponent(keyword)}`} class="chip">{keyword}</a>
					{/each}
				</nav>
			</article>
		{/if}
	</div>
</details>
