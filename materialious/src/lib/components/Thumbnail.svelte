<script lang="ts">
	import { getBestThumbnail } from '$lib/images';
	import { letterCase } from '$lib/letterCasing';
	import { cleanNumber, videoLength } from '$lib/numbers';
	import { onDestroy, onMount } from 'svelte';
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import { getDeArrow, getThumbnail, getVideoProgress } from '../api';
	import type { Notification, PlaylistPageVideo, Video, VideoBase } from '../api/model';
	import { insecureRequestImageHandler, truncate } from '../misc';
	import type { PlayerEvents } from '../player';
	import {
		authStore,
		deArrowEnabledStore,
		interfaceLowBandwidthMode,
		playerSavePlaybackPositionStore,
		syncPartyConnectionsStore,
		syncPartyPeerStore,
		synciousInstanceStore,
		synciousStore
	} from '../store';

	interface Props {
		video: VideoBase | Video | Notification | PlaylistPageVideo;
		playlistId?: string;
		sideways?: boolean;
	}

	let { video = $bindable(), playlistId = '', sideways = $bindable(false) }: Props = $props();

	let placeholderHeight: number = $state(0);

	let watchUrl = new URL(`${location.origin}/watch/${video.videoId}`);

	if (playlistId !== '') {
		watchUrl.searchParams.set('playlist', playlistId);
	}

	syncPartyPeerStore.subscribe((peer) => {
		if (peer) {
			watchUrl.searchParams.set('sync', peer.id);
		}
	});

	let thumbnail: HTMLImageElement | undefined = $state();

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

	let startedSideways = sideways === true;
	function disableSideways() {
		if (!startedSideways) return;

		if (window.innerWidth <= 1500) {
			sideways = false;
		} else sideways = true;
	}

	onMount(async () => {
		calcThumbnailPlaceholderHeight();

		// Check if sideways should be enabled or disabled.
		disableSideways();

		addEventListener('resize', () => {
			disableSideways();
			calcThumbnailPlaceholderHeight();
		});

		if (get(interfaceLowBandwidthMode)) return;

		let imageSrc = getBestThumbnail(video.videoThumbnails) as string;

		if (get(deArrowEnabledStore)) {
			try {
				const deArrow = await getDeArrow(video.videoId);
				for (const title of deArrow.titles) {
					if (title.locked || title.votes > 0) {
						video.title = title.title.replace('>', '');
						break;
					}
				}

				for (const thumbnail of deArrow.thumbnails) {
					if (thumbnail.locked || thumbnail.original || thumbnail.votes > 0) {
						if (thumbnail.timestamp !== null) {
							imageSrc = await getThumbnail(video.videoId, thumbnail.timestamp);
						}
						break;
					}
				}
			} catch {}
		}

		const img = await insecureRequestImageHandler(imageSrc);
		img.onload = () => {
			thumbnail = img;
		};

		if (get(synciousStore) && get(synciousInstanceStore) && get(authStore)) {
			try {
				progress = (await getVideoProgress(video.videoId, { priority: 'low' }))[0].time.toString();
			} catch {}
		}
	});

	onDestroy(() => {
		removeEventListener('resize', disableSideways);
	});

	function syncChangeVideo() {
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

	function calcThumbnailPlaceholderHeight() {
		if (!sideways) {
			if (innerWidth < 1000) {
				if (innerWidth < 600) {
					placeholderHeight = innerWidth / 2;
				} else {
					placeholderHeight = innerWidth / 4;
				}
			} else {
				placeholderHeight = innerWidth / 12;
			}
		} else {
			placeholderHeight = 115;
		}
	}
</script>

<div class:sideways-root={sideways}>
	<div onfocus={() => {}} id="thumbnail-container" role="region">
		<a
			class="wave thumbnail"
			href={watchUrl.toString()}
			data-sveltekit-preload-data="off"
			onclick={syncChangeVideo}
		>
			{#if !$interfaceLowBandwidthMode}
				{#if !thumbnail}
					<div class="secondary-container" style="width: 100%;height: {placeholderHeight}px;"></div>
				{:else}
					<img class="responsive" src={thumbnail.src} alt="Thumbnail for video" />
				{/if}
			{/if}
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
					{#if !$interfaceLowBandwidthMode}
						<div
							class="absolute right bottom small-margin black white-text small-text thumbnail-corner"
						>
							&nbsp;{videoLength(video.lengthSeconds)}&nbsp;
						</div>
					{:else}
						<h3>{videoLength(video.lengthSeconds)}</h3>
					{/if}
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
				style="padding-left: 1px;"
				class="video-title"
				data-sveltekit-preload-data="off"
				href={watchUrl.toString()}
			>
				<span class="bold">{letterCase(truncate(video.title.trimEnd(), 80))}</span>
			</a>

			<div>
				<a class:author={!sideways} href={`/channel/${video.authorId}`}>{video.author}</a>
				{#if !('publishedText' in video) && 'viewCountText' in video}
					<span style="margin-top: 1em;">
						• {video.viewCountText}
						{$_('views')}
					</span>
				{/if}

				{#if 'publishedText' in video}
					<div class="max">
						{cleanNumber(video.viewCount)} • {video.publishedText}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.thumbnail {
		width: 100%;
		overflow: hidden;
	}

	.thumbnail img {
		object-fit: contain;
	}

	.sideways-root {
		height: 110px;
		display: flex;
		align-items: flex-start;
	}

	.sideways-root .thumbnail {
		width: 200px;
	}

	.video-title {
		word-wrap: break-word;
		overflow: hidden;
	}

	.thumbnail-details {
		display: flex;
		align-items: start;
		justify-content: start;
		padding: 0 1em 1em 1em;
		line-height: 1.5;
	}

	@media screen and (max-width: 1499px) {
		.sideways-root .thumbnail {
			width: 100%;
			max-height: 100%;
		}
	}
</style>
