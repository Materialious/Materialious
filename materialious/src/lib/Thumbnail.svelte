<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import {
		deArrowEnabled,
		playerSavePlaybackPosition,
		syncPartyConnections,
		syncPartyPeer
	} from '../store';
	import { getDeArrow, getThumbnail, getVideo } from './Api';
	import type { Notification, PlaylistPageVideo, Video, VideoBase } from './Api/model';
	import { cleanNumber, proxyVideoUrl, truncate, videoLength } from './misc';
	import type { PlayerEvents } from './player';

	export let video: VideoBase | Video | Notification | PlaylistPageVideo;
	export let playlistId: string = '';

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
	let failed = false;

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
			failed = true;
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
</script>

<a
	class="wave"
	style="width: 100%; overflow: hidden;min-height:100px;"
	href={watchUrl.toString()}
	data-sveltekit-preload-data="off"
	on:click={syncChangeVideo}
>
	{#if loading}
		<progress class="circle"></progress>
	{:else if loaded}
		<img
			class="responsive"
			style="max-width: 100%;min-height: 160px;"
			src={img.src}
			alt="Thumbnail for video"
		/>
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
			<div class="absolute right bottom small-margin black white-text small-text thumbnail-corner">
				&nbsp;{videoLength(video.lengthSeconds)}&nbsp;
			</div>
		{/if}
	{:else}
		<div class="absolute right bottom small-margin red white-text small-text thumbnail-corner">
			{$_('thumbnail.live')}
		</div>
	{/if}
</a>
<div class="small-padding">
	<nav class="no-margin">
		<div class="max">
			<a href={watchUrl.toString()}><div class="bold">{truncate(video.title)}</div></a>
			<div>
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
