<script lang="ts">
	import { _ } from '$lib/i18n';
	import { removePlaylistVideo } from '$lib/api';
	import { invidiousAuthStore, feedLastItemId, isAndroidTvStore } from '$lib/store';
	import ContentColumn from '$lib/components/layout/ContentColumn.svelte';
	import { onMount } from 'svelte';
	import Thumbnail from '$lib/components/thumbnail/VideoThumbnail.svelte';
	import { extractUniqueId, timeout, type feedItems } from '$lib/misc';
	import ChannelThumbnail from '$lib/components/thumbnail/ChannelThumbnail.svelte';
	import PlaylistThumbnail from '$lib/components/thumbnail/PlaylistThumbnail.svelte';
	import HashtagThumbnail from '$lib/components/thumbnail/HashtagThumbnail.svelte';
	import NoResults from '$lib/components/NoResults.svelte';
	import { SpatialMenu } from 'melt/builders';
	import { mergeAttrs } from 'melt';
	import { Capacitor } from '@capacitor/core';

	interface Props {
		items?: feedItems;
		playlistId?: string;
		playlistAuthor?: string;
		classes?: string;
	}

	let {
		items = [],
		playlistId = '',
		playlistAuthor = '',
		classes = 'page right active'
	}: Props = $props();

	async function removePlaylistItem(indexId: string) {
		if (!playlistId) return;
		await removePlaylistVideo(playlistId, indexId);
	}

	onMount(async () => {
		if (!$feedLastItemId) return;

		const element = document.getElementById($feedLastItemId);

		if (element) {
			await timeout(100);
			element.focus();
			element.scrollIntoView({
				behavior: 'instant',
				block: 'start',
				inline: 'nearest'
			});
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

<div
	class={classes}
	class:item-container={Capacitor.getPlatform() !== 'android' || $isAndroidTvStore}
>
	{#if items.length === 0}
		<NoResults />
	{/if}
	<div class="grid" {...spatialMenu.root}>
		{#each items as item, index (index)}
			{@const uniqueItemId = extractUniqueId(item)}
			{@const spatialItem = spatialMenu.getItem(item, { onSelect: () => goToItem(uniqueItemId) })}
			<ContentColumn>
				<article
					{...mergeAttrs(spatialItem.attrs, {
						onclick: () => goToItem(uniqueItemId),
						id: uniqueItemId
					})}
					class="no-padding item-select border"
					class:item-select-focused={spatialItem.highlighted}
					style="height: 100%;"
				>
					{#if item.type === 'video' || item.type === 'shortVideo' || item.type === 'stream' || item.type === 'historyVideo'}
						{#key item.videoId}
							<Thumbnail video={item} {playlistId} />
						{/key}
						{#if $invidiousAuthStore && decodeURIComponent($invidiousAuthStore.username) === playlistAuthor && 'indexId' in item}
							<div class="right-align" style="margin: 1em .5em;">
								<button
									onclick={async () => removePlaylistItem(item.indexId)}
									class="tertiary circle small"
								>
									<i>delete</i>
									<div class="tooltip">{$_('delete')}</div>
								</button>
							</div>
						{/if}
					{:else if item.type === 'channel'}
						<ChannelThumbnail channel={item} />
					{:else if item.type === 'playlist'}
						<PlaylistThumbnail playlist={item} />
					{:else if item.type === 'hashtag'}
						<HashtagThumbnail hashtag={item} />
					{/if}
				</article>
			</ContentColumn>
		{/each}
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
