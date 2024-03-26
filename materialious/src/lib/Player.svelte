<script lang="ts">
	import 'vidstack/bundle';

	import { SponsorBlock, type Category } from 'sponsorblock-api';
	import { onDestroy, onMount } from 'svelte';
	import { get } from 'svelte/store';
	import type { MediaTimeUpdateEvent, PlayerSrc } from 'vidstack';
	import type { MediaPlayerElement } from 'vidstack/elements';
	import {
		playerAlwaysLoop,
		playerAutoPlay,
		playerDash,
		playerProxyVideos,
		playerSavePlaybackPosition,
		sponsorBlockCategories,
		sponsorBlockUrl
	} from '../store';
	import type { VideoPlay } from './Api/model';

	export let data: { video: VideoPlay };
	export let currentTime: number = 0;
	export let audioMode = false;

	let player: MediaPlayerElement;
	let src: PlayerSrc = [];
	let categoryBeingSkipped = '';
	let captions: { label: string; srcLang: string; src: string }[] = [];

	export function seekTo(time: number) {
		if (typeof player !== 'undefined') {
			player.currentTime = time;
		}
	}

	const proxyVideos = get(playerProxyVideos);

	onMount(async () => {
		if (!data.video.hlsUrl) {
			if (data.video.captions) {
				data.video.captions.forEach(async (caption) => {
					player.textTracks.add({
						label: caption.label,
						kind: 'captions',
						language: caption.language_code,
						src: `${import.meta.env.VITE_DEFAULT_INVIDIOUS_INSTANCE}${caption.url}`
					});
				});
			}

			player.addEventListener('time-update', () => {
				currentTime = player.currentTime;
			});

			player.addEventListener('pause', () => {
				savePlayerPos();
			});

			if (get(sponsorBlockCategories)) {
				const currentCategories = get(sponsorBlockCategories);

				if (currentCategories.length > 0) {
					const sponsorBlock = new SponsorBlock('', { baseURL: get(sponsorBlockUrl) });

					try {
						const segments = await sponsorBlock.getSegments(
							data.video.videoId,
							get(sponsorBlockCategories) as Category[]
						);

						player.addEventListener('time-update', (event: MediaTimeUpdateEvent) => {
							segments.forEach((segment) => {
								if (
									event.detail.currentTime >= segment.startTime &&
									event.detail.currentTime <= segment.endTime
								) {
									categoryBeingSkipped = segment.category;
									player.currentTime = segment.endTime + 1;
									ui('#sponsorblock-alert');
								}
							});
						});
					} catch {}
				}
			}

			if (get(playerDash)) {
				src = [{ src: data.video.dashUrl + '?local=true', type: 'application/dash+xml' }];
			} else {
				let formattedSrc;
				src = data.video.formatStreams.map((format) => {
					if (proxyVideos) {
						const rawSrc = new URL(format.url);
						rawSrc.host = import.meta.env.VITE_DEFAULT_INVIDIOUS_INSTANCE.replace(
							'http://',
							''
						).replace('https://', '');

						formattedSrc = rawSrc.toString();
					} else {
						formattedSrc = format.url;
					}
					return {
						src: formattedSrc,
						type: format.type.split(';')[0]
					};
				});
			}

			if (get(playerSavePlaybackPosition)) {
				const playerPos = localStorage.getItem(`v_${data.video.videoId}`);
				if (playerPos) {
					player.currentTime = Number(playerPos);
				}
			}
		} else {
			src = [
				{
					src: data.video.hlsUrl + '?local=true',
					type: 'application/x-mpegurl'
				}
			];
		}
	});

	function savePlayerPos() {
		if (get(playerSavePlaybackPosition) && player.currentTime) {
			if (player.currentTime < player.duration - 10 && player.currentTime > 10) {
				localStorage.setItem(`v_${data.video.videoId}`, player.currentTime.toString());
			} else {
				localStorage.removeItem(`v_${data.video.videoId}`);
			}
		}
	}

	onDestroy(() => {
		savePlayerPos();
		player.destroy();
	});
</script>

<media-player
	bind:this={player}
	autoPlay={$playerAutoPlay}
	loop={$playerAlwaysLoop}
	title={data.video.title}
	streamType={data.video.hlsUrl ? 'live' : 'on-demand'}
	viewType={audioMode ? 'audio' : 'video'}
	playsInline={true}
	{src}
>
	<media-provider>
		{#if !audioMode}
			<media-poster class="vds-poster" src={data.video.videoThumbnails[0].url}></media-poster>
		{/if}
	</media-provider>
	<media-audio-layout></media-audio-layout>
	{#if data.video.storyboards && data.video.storyboards.length > 3}
		<media-video-layout
			thumbnails={`${import.meta.env.VITE_DEFAULT_INVIDIOUS_INSTANCE}${data.video.storyboards[3].url}`}
		></media-video-layout>
	{:else}
		<media-video-layout></media-video-layout>
	{/if}
</media-player>

<div class="snackbar" id="sponsorblock-alert">
	<span
		>Skipping <span class="bold" style="text-transform: capitalize;">{categoryBeingSkipped}</span
		></span
	>
</div>
