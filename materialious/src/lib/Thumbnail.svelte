<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import {
		deArrowEnabled,
		interfacePreviewVideoOnHover,
		playerProxyVideos,
		playerSavePlaybackPosition,
		syncPartyConnections,
		syncPartyPeer
	} from '../store';
	import { getDeArrow, getThumbnail, getVideo } from './Api';
	import type { Notification, PlaylistPageVideo, Video, VideoBase, VideoPlay } from './Api/model';
	import { cleanNumber, proxyVideoUrl, videoLength } from './misc';
	import type { PlayerEvents } from './player';

	export let video: VideoBase | Video | Notification | PlaylistPageVideo;
	export let playlistId: string = '';

	let showVideoPreview: boolean = false;
	let videoPreview: VideoPlay | null = null;
	let videoPreviewMuted: boolean = true;

	let watchUrl = new URL(`${import.meta.env.VITE_DEFAULT_FRONTEND_URL}/watch/${video.videoId}`);

	if (playlistId !== '') {
		watchUrl.searchParams.set('playlist', playlistId);
	}

	syncPartyPeer.subscribe((peer) => {
		if (peer) {
			watchUrl.searchParams.set('sync', peer.id);
		}
	});

	let loading = true;
	let loaded = false;

	let img: HTMLImageElement;

	let progress: string | null;
	if (get(playerSavePlaybackPosition)) {
		try {
			progress = localStorage.getItem(`v_${video.videoId}`);
		} catch {
			progress = null;
		}
	} else {
		progress = null;
	}

	onMount(async () => {
		let imageSrc = video.videoThumbnails[4].url;

		if (get(deArrowEnabled)) {
			let locatedThumbnail = false;

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
						locatedThumbnail = true;
						break;
					}
				}
			} catch {}

			if (!locatedThumbnail) {
				// Process thumbnail locally.
				const canvas = document.getElementById('canvas') as HTMLCanvasElement | null;
				function generateThumbnail(): Promise<string> {
					return new Promise<string>(async (resolve, reject) => {
						if (canvas) {
							const context = canvas.getContext('2d');
							const mockVideo = document.createElement('video');
							const videoContainer = document.getElementById('video-container');
							videoContainer?.appendChild(mockVideo);

							mockVideo.preload = 'auto';
							mockVideo.id = 'video';
							mockVideo.crossOrigin = import.meta.env.VITE_DEFAULT_FRONTEND_URL;
							mockVideo.src = proxyVideoUrl((await getVideo(video.videoId)).formatStreams[0].url);

							mockVideo.addEventListener('loadeddata', () => {
								mockVideo.currentTime = mockVideo.duration / 100;

								mockVideo.addEventListener('seeked', () => {
									if (context) {
										context.drawImage(mockVideo, 0, 0, canvas.width, canvas.height);
										resolve(canvas.toDataURL('image/png'));
										mockVideo.preload = 'none';
										mockVideo.pause();
										videoContainer?.removeChild(mockVideo);
									}
								});
							});
							mockVideo.load();
						}
					});
				}

				imageSrc = await generateThumbnail();
			}
		}

		img = new Image();
		img.src = imageSrc;

		img.onload = () => {
			loaded = true;
			loading = false;
		};
		img.onerror = () => {
			loading = false;
		};
	});

	function syncChangeVideo() {
		if ($syncPartyConnections) {
			const events = {
				events: [{ type: 'change-video', videoId: video.videoId }]
			} as PlayerEvents;

			if (playlistId) {
				events.events.unshift({
					type: 'playlist',
					playlistId: playlistId
				});
			}
			$syncPartyConnections.forEach((conn) => {
				conn.send(events);
			});
		}
	}

	async function previewVideo() {
		if (!get(interfacePreviewVideoOnHover)) return;

		showVideoPreview = true;
		try {
			videoPreview = await getVideo(video.videoId, get(playerProxyVideos));
			if (videoPreview.hlsUrl) {
				showVideoPreview = false;
				videoPreview = null;
			}
		} catch {
			showVideoPreview = true;
		}
	}
</script>

<div
	style="position: relative;"
	on:mouseover={previewVideo}
	on:mouseleave={() => (showVideoPreview = false)}
	on:focus={() => {}}
	role="region"
>
	<a
		class="wave thumbnail"
		href={watchUrl.toString()}
		data-sveltekit-preload-data="off"
		on:click={syncChangeVideo}
	>
		{#if loading}
			<progress class="circle"></progress>
		{:else if loaded}
			{#if showVideoPreview && videoPreview}
				<div style="max-width: 100%; max-height: 200px;">
					<video
						style="max-width: 100%; max-height: 200px;"
						autoplay
						poster={img.src}
						width="100%"
						height="100%"
						muted={videoPreviewMuted}
						volume={0.5}
						src={videoPreview.formatStreams[0].url}
					>
					</video>
				</div>
			{:else}
				<img
					class="responsive"
					style="max-width: 100%;min-height: 160px;"
					src={img.src}
					alt="Thumbnail for video"
				/>
			{/if}
		{:else}
			<p>{$_('thumbnail.failedToLoadImage')}</p>
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
				<div
					class="absolute right bottom small-margin black white-text small-text thumbnail-corner"
				>
					&nbsp;{videoLength(video.lengthSeconds)}&nbsp;
				</div>
			{/if}
		{:else}
			<div class="absolute right bottom small-margin red white-text small-text thumbnail-corner">
				{$_('thumbnail.live')}
			</div>
		{/if}
	</a>
	{#if showVideoPreview && videoPreview}
		<button
			class="no-padding"
			style="position: absolute; bottom: 10px; left: 10px; width: 30px; height: 30px;"
			on:click={() => {
				videoPreviewMuted = !videoPreviewMuted;
			}}
		>
			<i>
				{#if videoPreviewMuted}
					volume_off
				{:else}
					volume_up
				{/if}
			</i>
		</button>
	{/if}
</div>

<div class="small-padding">
	<nav class="no-margin">
		<div class="max">
			<a
				href={watchUrl.toString()}
				style="display: flex; justify-content:flex-start; position: absolute; width: 100%;"
				><div class="bold" style="white-space: nowrap; overflow: hidden;text-overflow: ellipsis;">
					{video.title}
				</div></a
			>
			<div style="margin-top: 1.4em;">
				<a href={`/channel/${video.authorId}`}>{video.author}</a
				>{#if !('publishedText' in video) && 'viewCountText' in video}
					&nbsp;• {video.viewCountText}{/if}
			</div>
			{#if 'publishedText' in video}
				<div>
					{cleanNumber(video.viewCount)} • {video.publishedText}
				</div>
			{/if}
		</div>
	</nav>
</div>

<canvas id="canvas" style="display: none;"></canvas>
<div id="video-container" style="display: none;"></div>

<style>
	.thumbnail {
		width: 100%;
		overflow: hidden;
		max-height: 160px;
	}

	@media screen and (max-width: 1000px) {
		.thumbnail {
			max-height: 100%;
		}
	}
</style>
