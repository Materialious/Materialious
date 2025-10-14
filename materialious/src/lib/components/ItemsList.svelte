<script lang="ts">
	import Thumbnail from '$lib/components/Thumbnail.svelte';
	import { _ } from '$lib/i18n';
	import { removePlaylistVideo } from '../api';
	import type {
		Channel,
		HashTag,
		Playlist,
		PlaylistPage,
		PlaylistPageVideo,
		Video,
		VideoBase
	} from '../api/model';
	import { authStore, feedLastItemId, isAndroidTvStore } from '../store';
	import ContentColumn from './ContentColumn.svelte';
	import { onMount, onDestroy, tick } from 'svelte';
	import Mousetrap from 'mousetrap';
	import { extractUniqueId } from '$lib/misc';
	import ChannelThumbnail from './ChannelThumbnail.svelte';
	import PlaylistThumbnail from './PlaylistThumbnail.svelte';
	import HashtagThumbnail from './HashtagThumbnail.svelte';

	interface Props {
		items?:
			| (VideoBase | Video | PlaylistPageVideo | Channel | Playlist | HashTag)[]
			| PlaylistPage[];
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

	let gridElement: HTMLElement;
	let focusableItems: HTMLElement[] = [];
	let currentFocusIndex = $state(0);
	let lastFocusIndex = $state(0); // Remember position when leaving grid
	let columns = $state(4); // Default columns for Android TV
	let isComponentActive = $state(false); // Track if focus is within this component

	async function removePlaylistItem(indexId: string) {
		if (!playlistId) return;
		await removePlaylistVideo(playlistId, indexId);
	}

	function calculateColumns() {
		if (!gridElement || !$isAndroidTvStore) return;

		const gridItems = gridElement.querySelectorAll('article[role="presentation"]');
		if (gridItems.length === 0) return;

		// Count items in first row by checking top position
		const firstItemTop = gridItems[0].getBoundingClientRect().top;
		let cols = 1;

		for (let i = 1; i < gridItems.length; i++) {
			const itemTop = gridItems[i].getBoundingClientRect().top;
			if (Math.abs(itemTop - firstItemTop) < 10) {
				cols++;
			} else {
				break;
			}
		}

		columns = Math.max(1, cols);
	}

	function setupAndroidTVNavigation() {
		if (!$isAndroidTvStore || !gridElement) return;

		focusableItems = Array.from(
			gridElement.querySelectorAll('article[role="presentation"]')
		) as HTMLElement[];

		calculateColumns();

		// Make items focusable and set current focus to stored position
		const initialFocusIndex = Math.min(lastFocusIndex, focusableItems.length - 1);
		currentFocusIndex = initialFocusIndex;
		updateTabIndex(initialFocusIndex);
	}

	// Update tabindex when focus changes to maintain proper focus order
	function updateTabIndex(focusIndex: number) {
		if (!$isAndroidTvStore || focusableItems.length === 0) return;

		focusableItems.forEach((focusableItem, index) => {
			focusableItem.tabIndex = index === focusIndex ? 0 : -1;
		});
	}

	// Check if focus is within the ItemsList component
	function checkComponentFocus() {
		if (!gridElement) return;

		const activeElement = document.activeElement;
		const isWithinComponent = gridElement.contains(activeElement);
		isComponentActive = isWithinComponent;

		// If focus left the component, store the position
		if (!isWithinComponent && focusableItems.length > 0) {
			lastFocusIndex = currentFocusIndex;
			updateTabIndex(currentFocusIndex);
		}
	}

	function handleNavigation(direction: 'up' | 'down' | 'left' | 'right', event: Event) {
		if (!$isAndroidTvStore || focusableItems.length === 0 || !isComponentActive) return true;

		let newIndex = currentFocusIndex;

		switch (direction) {
			case 'left':
				if (currentFocusIndex % columns === 0) {
					lastFocusIndex = currentFocusIndex;
					updateTabIndex(currentFocusIndex);
					return true;
				}
				newIndex = Math.max(0, currentFocusIndex - 1);
				break;
			case 'right':
				newIndex = Math.min(focusableItems.length - 1, currentFocusIndex + 1);
				break;
			case 'up':
				// Check if we're in the first row and trying to go up
				if (currentFocusIndex < columns) {
					// Store current position before leaving and ensure it stays focusable
					lastFocusIndex = currentFocusIndex;
					updateTabIndex(currentFocusIndex);
					return true;
				}
				newIndex = Math.max(0, currentFocusIndex - columns);
				break;
			case 'down':
				newIndex = Math.min(focusableItems.length - 1, currentFocusIndex + columns);
				break;
		}

		if (newIndex !== currentFocusIndex) {
			event.preventDefault();
			// Update focus
			updateTabIndex(newIndex);
			focusableItems[newIndex].focus();

			// Snap to view with instant behavior
			focusableItems[newIndex].scrollIntoView({
				behavior: 'auto',
				block: 'center',
				inline: 'center'
			});

			currentFocusIndex = newIndex;
			return false;
		}

		return true;
	}

	onMount(async () => {
		if ($feedLastItemId && !$isAndroidTvStore) {
			document
				.getElementById($feedLastItemId)
				?.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });

			feedLastItemId.set(undefined);
		}

		if ($isAndroidTvStore) {
			await tick();
			// Setup Android TV navigation
			setupAndroidTVNavigation();

			// Focus the correct item initially (first time or restored position)
			if (focusableItems.length > 0) {
				if ($feedLastItemId) {
					const focusedItemIndex = focusableItems.findIndex((item) => item.id === $feedLastItemId);
					feedLastItemId.set(undefined);

					if (focusedItemIndex !== -1) {
						focusableItems[focusedItemIndex]?.focus();
						currentFocusIndex = focusedItemIndex;
					}
				}
			}

			// Bind navigation keys
			Mousetrap.bind('up', (e) => handleNavigation('up', e), 'keydown');
			Mousetrap.bind('down', (e) => handleNavigation('down', e), 'keydown');
			Mousetrap.bind('left', (e) => handleNavigation('left', e), 'keydown');
			Mousetrap.bind('right', (e) => handleNavigation('right', e), 'keydown');

			// Watch for window resize to recalculate columns
			window.addEventListener('resize', calculateColumns);

			// Watch for focus changes to detect when we're active
			document.addEventListener('focusin', checkComponentFocus);
			document.addEventListener('focusout', checkComponentFocus);
		}
	});

	onDestroy(() => {
		if ($isAndroidTvStore) {
			Mousetrap.unbind(['up', 'down', 'left', 'right']);
			window.removeEventListener('resize', calculateColumns);
			document.removeEventListener('focusin', checkComponentFocus);
			document.removeEventListener('focusout', checkComponentFocus);
		}
	});

	// Update navigation when items change
	$effect(() => {
		if ($isAndroidTvStore && items.length > 0 && gridElement) {
			tick().then(() => setupAndroidTVNavigation());
		}
	});
</script>

<div class={classes} class:android-container={$isAndroidTvStore}>
	<div class="grid" bind:this={gridElement}>
		{#each items as item, index}
			<ContentColumn>
				<article
					class="no-padding android-tv-item border"
					class:android-tv-focused={$isAndroidTvStore}
					style="height: 100%;"
					id={extractUniqueId(item)}
					role="presentation"
					onclick={() => {
						feedLastItemId.set(extractUniqueId(item));

						// Required to pass click through to thumbnail component on Android TV
						if ($isAndroidTvStore) {
							const articleElement = document.getElementById(extractUniqueId(item));
							if (articleElement) {
								const clickable = articleElement.querySelector('a, button');
								if (clickable instanceof HTMLElement) {
									clickable.click();
								}
							}
						}
					}}
					onfocus={() => {
						if ($isAndroidTvStore) {
							currentFocusIndex = index;
						}
					}}
				>
					{#if item.type === 'video' || item.type === 'shortVideo' || item.type === 'stream'}
						<Thumbnail video={item} {playlistId} />
						{#if $authStore && decodeURIComponent($authStore.username) === playlistAuthor && 'indexId' in item}
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
	.android-container {
		padding: 0 1em;
	}

	.android-tv-item {
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease;
	}

	.android-tv-item:focus {
		transform: scale(1.05);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
		z-index: 10;
		position: relative;
		outline: 4px solid var(--primary);
	}
</style>
