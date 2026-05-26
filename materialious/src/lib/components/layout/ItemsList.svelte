<script lang="ts">
	import { feedLastItemId, filterContentListStore, isAndroidTvStore } from '$lib/store';
	import ContentColumn from '$lib/components/layout/ContentColumn.svelte';
	import { onMount } from 'svelte';
	import Thumbnail from '$lib/components/thumbnail/VideoThumbnail.svelte';
	import { extractUniqueId, type FeedItems } from '$lib/feed';
	import { isMobile, keyCodeMap, timeout } from '$lib/misc';
	import ChannelThumbnail from '$lib/components/thumbnail/ChannelThumbnail.svelte';
	import PlaylistThumbnail from '$lib/components/thumbnail/PlaylistThumbnail.svelte';
	import HashtagThumbnail from '$lib/components/thumbnail/HashtagThumbnail.svelte';
	import NoResults from '$lib/components/NoResults.svelte';
	import { getNextFocus } from '@bbc/tv-lrud-spatial';
	import { isItemFiltered } from '$lib/filtering/index';

	interface Props {
		items?: FeedItems;
		playlistId?: string;
		classes?: string;
	}

	let { items = [], playlistId = '', classes = 'page right active' }: Props = $props();

	let gridElement: HTMLElement;
	let focusedItemId: string | undefined = $state(undefined);

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && focusedItemId) {
			event.preventDefault();
			handleItemSelect(event, focusedItemId);
			return;
		}

		const keyCode = keyCodeMap[event.key];
		if (!keyCode) return;

		const nextFocus = getNextFocus(event.target as Element, keyCode, gridElement);

		if (nextFocus) {
			event.preventDefault();
			nextFocus.focus();
			focusedItemId = nextFocus.id;
		}
	}

	function goToItem(uniqueItemId: string) {
		const articleElement = document.getElementById(uniqueItemId);
		if (articleElement) {
			const clickable = articleElement.querySelector('a, button');
			if (clickable instanceof HTMLElement) {
				clickable.click();
			}
		}
	}

	function handleItemSelect(event: Event, uniqueItemId: string) {
		feedLastItemId.set(uniqueItemId);
		focusedItemId = uniqueItemId;

		if (event instanceof KeyboardEvent && event.key === 'Enter') goToItem(uniqueItemId);
	}

	onMount(async () => {
		if ($feedLastItemId) {
			const element = document.getElementById($feedLastItemId);

			if (element) {
				await timeout(100);

				element.scrollIntoView({
					behavior: 'instant',
					block: 'start',
					inline: 'nearest'
				});

				focusedItemId = $feedLastItemId;
				await timeout(0);
				const focusable = element.querySelector('a, button, [tabindex]');
				if (focusable instanceof HTMLElement) {
					focusable.focus();
				}
			}

			feedLastItemId.set(undefined);
		}
	});
</script>

<div
	onkeydown={handleKeyDown}
	class={classes}
	class:item-container={!isMobile() || $isAndroidTvStore}
>
	{#if items.length === 0}
		<NoResults />
	{/if}
	<div class="grid" bind:this={gridElement} role="navigation" tabindex="-1">
		{#key $filterContentListStore?.length}
			{#each items as item, index (index)}
				{#if !isItemFiltered(item)}
					{@const uniqueItemId = extractUniqueId(item)}
					<ContentColumn>
						<article
							onclick={(event) => handleItemSelect(event, uniqueItemId)}
							id={uniqueItemId}
							class="no-padding item-select border"
							class:item-select-focused={(!isMobile() || $isAndroidTvStore) &&
								focusedItemId === uniqueItemId}
							style="height: 100%;"
							tabindex="0"
						>
							{#if item.type === 'video' || item.type === 'shortVideo' || item.type === 'stream' || item.type === 'historyVideo'}
								{#key item.videoId}
									<Thumbnail video={item} {playlistId} />
								{/key}
							{:else if item.type === 'channel'}
								<ChannelThumbnail channel={item} />
							{:else if item.type === 'playlist'}
								<PlaylistThumbnail playlist={item} />
							{:else if item.type === 'hashtag'}
								<HashtagThumbnail hashtag={item} />
							{/if}
						</article>
					</ContentColumn>
				{/if}
			{/each}
		{/key}
	</div>
</div>

<style>
	.item-container {
		padding: 0 1em;
	}

	.item-select {
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease;
	}

	.item-select-focused {
		transform: scale(1.05);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
		z-index: 10;
		position: relative;
		outline: 1px solid var(--primary) !important;
	}

	.grid:focus {
		outline: none !important;
		box-shadow: none !important;
	}
</style>
