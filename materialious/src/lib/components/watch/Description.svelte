<script lang="ts">
	import { resolve } from '$app/paths';
	import { cleanNumber, numberWithCommas } from '$lib/numbers';
	import { _ } from '$lib/i18n';
	import type { VideoPlay } from '$lib/api/model';
	import { onMount } from 'svelte';
	import { expandSummery } from '$lib/misc';
	import { interfaceAutoExpandDesc } from '$lib/store';
	import { humanizeTimestamp } from '$lib/time';

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
				<span>
					{cleanNumber(video.viewCount)}
					{$_('views')}
					<div class="tooltip no-space">{numberWithCommas(video.viewCount)} {$_('views')}</div>
				</span>
				•
				<span>
					{video.publishedText}
					{#if !video.fallbackPatch}
						<div class="tooltip no-space">{humanizeTimestamp(video.published)}</div>
					{/if}
				</span>
			</div>
		</nav>
	</summary>
	<div class="space"></div>
	<div class="description">
		<div style="white-space: pre-line; overflow-wrap: break-word;">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html description}
			<!-- Description comes directly from YT so is already sanitized -->
		</div>

		{#if video.keywords && video.keywords.length > 0}
			<article class="border">
				<nav class="scroll">
					{#each video.keywords as keyword (keyword)}
						<a
							href={resolve(`/search/[search]`, { search: encodeURIComponent(keyword) })}
							class="chip">{keyword}</a
						>
					{/each}
				</nav>
			</article>
		{/if}
	</div>
</details>

<style>
	.description {
		overflow-y: scroll;
		overflow-x: hidden;
		max-height: 300px;
	}
</style>
