<script lang="ts">
	import {
		feedLastItemId,
		filterContentListStore,
		filterContentUrlAutoUpdateStore
	} from '#lib/store';
	import ContentColumn from '#lib/components/layout/ContentColumn.svelte';
	import { onMount } from 'svelte';
	import Thumbnail from '#lib/components/thumbnail/VideoThumbnail.svelte';
	import { extractUniqueId, type FeedItems } from '#lib/feed';
	import { isAndroidTv, isMobile, keyCodeMap, timeout } from '#lib/utils';
	import ChannelThumbnail from '#lib/components/thumbnail/ChannelThumbnail.svelte';
	import PlaylistThumbnail from '#lib/components/thumbnail/PlaylistThumbnail.svelte';
	import HashtagThumbnail from '#lib/components/thumbnail/HashtagThumbnail.svelte';
	import NoResults from '#lib/components/NoResults.svelte';
	import { getNextFocus } from '@bbc/tv-lrud-spatial';
	import { isItemFiltered } from '#lib/filtering/index';
	import PlaylistManager from '#lib/components/PlaylistManager.svelte';
	import { SvelteSet } from 'svelte/reactivity';

	interface Props {
		items?: FeedItems;
		playlistId?: string;
		classes?: string;
		multipleActions?: boolean;
		showActionButton?: boolean;
	}

	let {
		items = [],
		playlistId = '',
		classes = 'page right active',
		multipleActions = $bindable(false),
		showActionButton = true
	}: Props = $props();

	let gridElement: HTMLElement;
	let selectedIds = $state(new Set<string>());
	let visibleItems = $derived(items.filter((item) => !isItemFiltered(item)));
	let selectedItems = $derived(
		visibleItems.filter((item) => selectedIds.has(extractUniqueId(item)))
	);
	let selectedVideoIds = $derived(
		selectedItems.filter((item) => 'videoId' in item).map((item) => item.videoId)
	);
	$effect(() => {
		if (!multipleActions) selectedIds = new Set();
	});

	function toggleSelection(id: string) {
		const next = new SvelteSet(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	function finishSelection() {
		multipleActions = false;
		selectedIds = new Set();
	}

	function hideSelectedVideos(field: 'videoId' | 'authorId') {
		const values = [
			...new Set(
				selectedItems.flatMap((item) => {
					if (!('videoId' in item)) return [];
					if (field === 'videoId') return [item.videoId];
					return 'authorId' in item && item.authorId ? [item.authorId] : [];
				})
			)
		];
		if (!values.length) return;
		const names = [
			...new Set(
				selectedItems.flatMap((item) => {
					if (!('videoId' in item)) return [];
					if (field === 'videoId') return [item.title];
					return 'author' in item && item.author ? [item.author] : [];
				})
			)
		];
		const noteNames = names.length ? names : values;
		const note = `${field === 'videoId' ? 'Hidden videos' : 'Hidden channels'}: ${noteNames.join(', ')}`;
		filterContentListStore.update((filters) => [
			...filters,
			{
				type: 'video',
				conditions: [{ field, operator: 'in', values: [values], note }]
			}
		]);
		filterContentUrlAutoUpdateStore.set(false);
		finishSelection();
	}

	const cardOf = (el: Element | null) => el?.closest<HTMLElement>('article.item-select') ?? null;

	function handleKeyDown(event: KeyboardEvent) {
		const card = cardOf(event.target as Element);

		if (event.key === 'Enter' && card) {
			event.preventDefault();
			if (multipleActions) toggleSelection(card.id);
			else handleItemSelect(event, card.id);
			return;
		}

		const keyCode = keyCodeMap[event.key];
		if (!keyCode) return;

		// Move card to card: links/buttons inside a card are not separate stops.
		const next = cardOf(getNextFocus(card ?? (event.target as Element), keyCode, gridElement));

		if (next && next !== card) {
			event.preventDefault();
			next.focus({ preventScroll: true });
			next.scrollIntoView({ block: 'center', inline: 'nearest' });
			return;
		}

		// Left edge of the grid: go to the side menu (native spatial nav loses focus here).
		const menuItem =
			document.querySelector<HTMLElement>('#left-nav a.active') ??
			document.querySelector<HTMLElement>('#left-nav a');
		if (!next && keyCode === 37 && isAndroidTv() && menuItem) {
			event.preventDefault();
			menuItem.focus();
		}
	}

	// Focus arriving from outside (native spatial nav) can land on a link inside a card.
	function handleFocusIn(event: FocusEvent) {
		if (!isAndroidTv()) return;
		const card = cardOf(event.target as Element);
		if (card && card !== event.target) card.focus();
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
	onfocusin={handleFocusIn}
	class={classes}
	class:item-container={!isMobile() || isAndroidTv()}
>
	{#if showActionButton && visibleItems.length > 0 && !isAndroidTv()}
		<div class="bulk-actions right-align">
			<button
				class="surface-container-highest"
				aria-label="Bulk actions"
				aria-pressed={multipleActions}
				onclick={() => (multipleActions = !multipleActions)}
			>
				<i>checklist</i><span class="m l">Bulk actions</span>
			</button>
		</div>
	{/if}
	{#if multipleActions}
		<div class="bulk-actions surface-container" role="toolbar" aria-label="Bulk actions">
			<div class="bulk-header">
				<div class="bulk-title">
					<strong>Bulk actions</strong>
					<span>{selectedIds.size} selected</span>
				</div>
				<button
					class="surface-container-highest"
					onclick={() => {
						const allSelected = visibleItems.every((item) =>
							selectedIds.has(extractUniqueId(item))
						);
						selectedIds = allSelected ? new Set() : new Set(visibleItems.map(extractUniqueId));
					}}
				>
					{visibleItems.every((item) => selectedIds.has(extractUniqueId(item)))
						? 'Deselect all'
						: 'Select all'}
				</button>
			</div>
			<div class="bulk-controls">
				{#if selectedVideoIds.length > 0}
					<div class="bulk-video-actions">
						<PlaylistManager
							mode="clone"
							videoIds={selectedVideoIds}
							buttonText="Add to playlist"
							buttonIcon="playlist_add"
							buttonClasses="surface-container-highest"
						/>
						<button class="surface-container-highest" onclick={() => hideSelectedVideos('videoId')}
							><i>filter_alt</i>Filter videos</button
						>
						<button class="surface-container-highest" onclick={() => hideSelectedVideos('authorId')}
							><i>person_off</i>Filter channels</button
						>
					</div>
				{/if}
			</div>
		</div>
	{/if}
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
							onclick={(event) => {
								if (multipleActions) {
									event.preventDefault();
									toggleSelection(uniqueItemId);
								} else handleItemSelect(event, uniqueItemId);
							}}
							id={uniqueItemId}
							class="no-padding item-select border"
							class:bulk-selection={multipleActions}
							class:selected={multipleActions && selectedIds.has(uniqueItemId)}
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

	.bulk-actions {
		margin: 0.5rem 0 1rem;
		padding: 1rem;
		border-radius: 1rem;
	}

	.bulk-header,
	.bulk-title,
	.bulk-controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.bulk-header {
		justify-content: space-between;
	}

	.bulk-title {
		gap: 0.5rem;
	}

	.bulk-title span,
	.bulk-label {
		font-size: 0.9em;
		opacity: 0.75;
	}

	.bulk-controls {
		margin-top: 0.75rem;
	}

	.bulk-video-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.item-select.selected {
		outline: 2px solid var(--primary);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 25%, transparent);
	}

	.item-select.bulk-selection {
		padding: 0.5rem !important;
	}

	.item-container .item-select:focus-within {
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
