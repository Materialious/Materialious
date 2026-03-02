<script lang="ts">
	import { resolve } from '$app/paths';
	import { getBestThumbnail } from '$lib/images';
	import { letterCase } from '$lib/letterCasing';
	import { cleanNumber, videoLength } from '$lib/numbers';
	import { onDestroy, onMount } from 'svelte';
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import { getDeArrow, getThumbnail } from '$lib/api';
	import { Avatar } from 'melt/builders';
	import type {
		Notification,
		PlaylistPageVideo,
		Video,
		VideoBase,
		VideoWatchHistory
	} from '$lib/api/model';
	import { createVideoUrl } from '$lib/misc';
	import type { PlayerEvents } from '$lib/player';
	import {
		deArrowEnabledStore,
		playerSavePlaybackPositionStore,
		playerState,
		rawMasterKeyStore,
		syncPartyConnectionsStore,
		syncPartyPeerStore
	} from '$lib/store';
	import { relativeTimestamp } from '$lib/time';
	import { queueGetWatchHistory } from '$lib/api/backend/historyPool';
	import { page } from '$app/state';
	import { isOwnBackend } from '$lib/shared';

	interface Props {
		video: VideoBase | Video | Notification | PlaylistPageVideo | VideoWatchHistory;
		playlistId?: string;
		sideways?: boolean;
	}

	let { video = $bindable(), playlistId = '', sideways = $bindable(false) }: Props = $props();

	let watchUrl = createVideoUrl(video.videoId, playlistId);

	let beenWatched: boolean = $state(false);

	syncPartyPeerStore.subscribe((peer) => {
		if (peer) {
			watchUrl.searchParams.set('sync', peer.id);
		}
	});

	let progress: string | undefined = $state();
	if (get(playerSavePlaybackPositionStore)) {
		try {
			progress = localStorage.getItem(`v_${video.videoId}`) ?? undefined;
		} catch {
			progress = undefined;
		}
	} else {
		progress = undefined;
	}

	let thumbnailSrc = $state(
		'thumbnail' in video ? video.thumbnail : (getBestThumbnail(video.videoThumbnails) as string)
	);

	if (get(deArrowEnabledStore)) {
		try {
			getDeArrow(video.videoId, { priority: 'low' }).then(async (deArrow) => {
				for (const title of deArrow.titles) {
					if (title.locked || title.votes > 0) {
						video.title = title.title.replace('>', '');
						break;
					}
				}

				for (const thumbnail of deArrow.thumbnails) {
					if (thumbnail.locked || thumbnail.original || thumbnail.votes > 0) {
						if (thumbnail.timestamp !== null) {
							thumbnailSrc = await getThumbnail(video.videoId, thumbnail.timestamp, {
								priority: 'low'
							});
						}
						break;
					}
				}
			});
		} catch {
			// Continue regardless of error
		}
	}

	const thumbnail = new Avatar({ src: () => thumbnailSrc });
	let thumbnailHTMLElement: HTMLImageElement | undefined = $state();

	let startedSideways = sideways === true;
	function disableSideways() {
		if (!startedSideways) return;

		if (window.innerWidth <= 1800) {
			sideways = false;
		} else sideways = true;
	}

	function checkIfWatched() {
		beenWatched = !!(progress && !page.url.pathname.endsWith('/history'));
	}

	onMount(async () => {
		// Check if sideways should be enabled or disabled.
		disableSideways();
		checkIfWatched();

		if (
			!page.url.pathname.endsWith('/history') &&
			isOwnBackend()?.internalAuth &&
			get(rawMasterKeyStore)
		)
			queueGetWatchHistory(video.videoId).then((watchHistory) => {
				if (watchHistory) {
					progress = watchHistory.progress.toString();
					checkIfWatched();
				}
			});
	});

	onDestroy(() => {
		removeEventListener('resize', disableSideways);
	});

	function onVideoSelected() {
		playerState.set(undefined);

		if ($syncPartyConnectionsStore) {
			const events = {
				events: [{ type: 'change-video', videoId: video.videoId }]
			} as PlayerEvents;

			if (playlistId) {
				events.events.unshift({
					type: 'playlist',
					playlistId: playlistId
				});
			}
			$syncPartyConnectionsStore.forEach((conn) => {
				conn.send(events);
			});
		}
	}
</script>

<div class:sideways-root={sideways} tabindex="0" role="button">
	<div id="thumbnail-container">
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a
			tabindex="-1"
			class="wave thumbnail"
			href={watchUrl.toString()}
			data-sveltekit-preload-data="off"
			onclick={onVideoSelected}
		>
			<div class="thumbnail-image">
				<div class:crop={thumbnailHTMLElement ? thumbnailHTMLElement.height > 300 : false}>
					<img
						class="responsive"
						class:watched={beenWatched}
						{...thumbnail.image}
						bind:this={thumbnailHTMLElement}
						alt="Thumbnail for video"
					/>
				</div>
				<div
					{...thumbnail.fallback}
					class="secondary-container responsive"
					style="height: 200px;"
				></div>

				{#if beenWatched}
					<div class="chip surface-container-highest">
						<i>check</i>
					</div>
				{/if}
			</div>
			{#if progress}
				<progress
					class="absolute right bottom"
					style="z-index: 1;"
					value={progress}
					max={video.lengthSeconds}
				></progress>
			{/if}
			{#if !('liveVideo' in video) || !video.liveVideo}
				{#if video.lengthSeconds !== 0}
					<div
						class="absolute right bottom small-margin black white-text small-text thumbnail-corner"
					>
						&nbsp;{videoLength(video.lengthSeconds)}&nbsp;
					</div>
				{/if}
			{:else if video.lengthSeconds !== 0}
				<div class="absolute right bottom small-margin red white-text small-text thumbnail-corner">
					{$_('thumbnail.live')}
				</div>
			{:else}
				<h3>{$_('thumbnail.live')}</h3>
			{/if}
		</a>
	</div>

	<div class="thumbnail-details video-title">
		<div class="video-title">
			<a
				tabindex="-1"
				style="padding-left: 1px;"
				class="video-title"
				data-sveltekit-preload-data="off"
				href={watchUrl.toString()}
				onclick={onVideoSelected}
			>
				<span class="bold">{letterCase(video.title.trimEnd())}</span>
			</a>

			<div>
				{#if 'authorId' in video && video.authorId}
					<a
						tabindex="-1"
						class:author={!sideways}
						href={resolve(`/channel/[authorId]`, { authorId: video.authorId })}
						data-sveltekit-preload-data="off"
						>{video.author}
					</a>
				{:else}
					<p>{video.author}</p>
				{/if}

				{#if 'promotedBy' in video && video.promotedBy === 'favourited'}
					<i>star</i>
				{/if}

				{#if !('publishedText' in video) && 'viewCountText' in video}
					•
					{video.viewCountText ?? cleanNumber(video.viewCount ?? 0)}
					{$_('views')}
				{/if}

				{#if 'published' in video}
					<div class="max">
						{video.viewCountText ?? cleanNumber(video.viewCount ?? 0)}
						•
						{video.published && video.published !== 0
							? relativeTimestamp(video.published * 1000, false)
							: video.publishedText}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.crop {
		position: relative;
		width: 100%;
		overflow: hidden;
	}

	.crop img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		clip-path: inset(10% 0 10% 0);
		display: block;
		transform: translateY(-15%);
		margin-bottom: -20%;
	}

	.thumbnail {
		width: 100%;
		overflow: hidden;
		display: inline-block;
	}

	.thumbnail img {
		object-fit: contain;
	}

	.sideways-root {
		height: 112px;
		display: flex;
		align-items: flex-start;
	}

	.sideways-root .thumbnail {
		width: 200px;
		flex-shrink: 0;
	}

	.sideways-root .thumbnail-details {
		flex: 1;
		min-width: 0;
		padding-right: 0.5em;
	}

	.sideways-root .video-title {
		overflow: hidden;
	}

	.sideways-root .video-title span {
		display: block;
		white-space: normal;
		overflow: hidden;
		word-wrap: break-word;
		line-height: 1.2;
	}

	.video-title {
		word-wrap: break-word;
		overflow: hidden;
		border-radius: 0px;
	}

	.thumbnail-details {
		display: flex;
		align-items: start;
		justify-content: start;
		padding: 0 1em 1em 1em;
		line-height: 1.5;
	}

	.thumbnail-image {
		position: relative;
	}

	.thumbnail-image .chip {
		position: absolute;
		top: 8px;
		right: 8px;
	}

	.watched {
		filter: brightness(40%);
	}

	@media screen and (max-width: 1499px) {
		.sideways-root .thumbnail {
			width: 100%;
			max-height: 100%;
		}

		.sideways-root .thumbnail-details {
			display: none;
		}
	}
</style>
