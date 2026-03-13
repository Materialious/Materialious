<script lang="ts">
	import { feedLastItemId, filterContentListStore, isAndroidTvStore } from '$lib/store';
	import ContentColumn from '$lib/components/layout/ContentColumn.svelte';
	import { onMount } from 'svelte';
	import Thumbnail from '$lib/components/thumbnail/VideoThumbnail.svelte';
	import { extractUniqueId, type FeedItems } from '$lib/feed';
	import { isMobile, timeout } from '$lib/misc';
	import ChannelThumbnail from '$lib/components/thumbnail/ChannelThumbnail.svelte';
	import PlaylistThumbnail from '$lib/components/thumbnail/PlaylistThumbnail.svelte';
	import HashtagThumbnail from '$lib/components/thumbnail/HashtagThumbnail.svelte';
	import NoResults from '$lib/components/NoResults.svelte';
	import { SpatialMenu } from 'melt/builders';
	import { mergeAttrs } from 'melt';
	import { isItemFiltered } from '$lib/filtering/index';

	interface Props {
		items?: FeedItems;
		playlistId?: string;
		classes?: string;
	}

	let { items = [], playlistId = '', classes = 'page right active' }: Props = $props();

	onMount(async () => {
		if (!$feedLastItemId) return;

		const element = document.getElementById($feedLastItemId);

		if (element) {
			await timeout(100);

			element.scrollIntoView({
				behavior: 'instant',
				block: 'start',
				inline: 'nearest'
			});

			const lastItem = items.find((item) => extractUniqueId(item) === $feedLastItemId);
			if (lastItem) {
				spatialMenu.highlighted = lastItem;
			}
		}

		feedLastItemId.set(undefined);
	});

	function goToItem(uniqueItemId: string) {
		feedLastItemId.set(uniqueItemId);

		const articleElement = document.getElementById(uniqueItemId);
		if (articleElement) {
			const clickable = articleElement.querySelector('a, button');
			if (clickable instanceof HTMLElement) {
				clickable.click();
			}
		}
	}

	const spatialMenu = new SpatialMenu({
		wrap: false,
		crossAxis: false,
		scrollBehavior: 'instant'
	});
</script>

<div class={classes} class:item-container={!isMobile() && !$isAndroidTvStore}>
	{#if items.length === 0}
		<NoResults />
	{/if}
	<div class="grid" {...spatialMenu.root}>
		{#key $filterContentListStore?.length}
			{#each items as item, index (index)}
				{#if !isItemFiltered(item)}
					{@const uniqueItemId = extractUniqueId(item)}
					{@const spatialItem = spatialMenu.getItem(item, {
						onSelect: () => {
							if ($isAndroidTvStore) goToItem(uniqueItemId);
						}
					})}
					<ContentColumn>
						<article
							{...mergeAttrs(spatialItem.attrs, {
								onclick: () => {
									if ($isAndroidTvStore) goToItem(uniqueItemId);
								},
								id: uniqueItemId
							})}
							class="no-padding item-select border"
							class:item-select-focused={!isMobile() && spatialItem.highlighted}
							style="height: 100%;"
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
		outline: 1px solid var(--primary);
	}

	.grid:focus {
		outline: none !important;
		box-shadow: none !important;
	}
</style>
