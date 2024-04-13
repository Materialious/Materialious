<script lang="ts">
	import 'vidstack/bundle';

	import { SponsorBlock, type Category } from 'sponsorblock-api';
	import { onDestroy, onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
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
	import { proxyVideoUrl, videoLength, type PhasedDescription } from './misc';
	import { getDynamicTheme } from './theme';

	export let data: { video: VideoPlay; content: PhasedDescription; playlistId: string | null };
	export let audioMode = false;
	export let player: MediaPlayerElement;
	export let isSyncing: boolean = false;

	let src: PlayerSrc = [];
	let categoryBeingSkipped = '';
	let playerIsLive = false;
	let playerPosSet = false;

	export function seekTo(time: number) {
		if (typeof player !== 'undefined') {
			player.currentTime = time;
		}
	}

	const proxyVideos = get(playerProxyVideos);

	onMount(async () => {
		if (!data.video.hlsUrl) {
			playerIsLive = false;
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

			if (data.content.timestamps) {
				let chapterWebVTT = 'WEBVTT\n\n';

				let timestampIndex = 0;
				data.content.timestamps.forEach((timestamp) => {
					let endTime: string;
					if (timestampIndex === data.content.timestamps.length - 1) {
						endTime = videoLength(data.video.lengthSeconds);
					} else {
						endTime = data.content.timestamps[timestampIndex + 1].timePretty;
					}

					chapterWebVTT += `${timestamp.timePretty} --> ${endTime}\n${timestamp.title.replaceAll('-', '').trim()}\n\n`;

					timestampIndex += 1;
				});

				player.textTracks.add({
					kind: 'chapters',
					src: URL.createObjectURL(new Blob([chapterWebVTT])),
					default: true
				});
			}

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
									if (Math.round(player.currentTime) >= Math.round(player.duration)) {
										return;
									}
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
				player.addEventListener('dash-can-play', () => {
					loadPlayerPos();
				});

				src = [{ src: data.video.dashUrl + '?local=true', type: 'application/dash+xml' }];
			} else {
				let formattedSrc;
				src = data.video.formatStreams.map((format) => {
					if (proxyVideos) {
						formattedSrc = proxyVideoUrl(format.url);
					} else {
						formattedSrc = format.url;
					}
					const quality = format.size.split('x');
					return {
						src: formattedSrc,
						type: format.type.split(';')[0],
						height: Number(quality[1]),
						width: Number(quality[0])
					};
				});

				loadPlayerPos();
			}
		} else {
			playerIsLive = true;
			src = [
				{
					src: data.video.hlsUrl + '?local=true',
					type: 'application/x-mpegurl'
				}
			];
		}

		player.storage = 'video-player';

		const currentTheme = await getDynamicTheme();

		document.documentElement.style.setProperty(
			'--media-slider-track-fill-bg',
			currentTheme['--primary']
		);
		document.documentElement.style.setProperty('--media-menu-bg', currentTheme['--background']);
		document.documentElement.style.setProperty(
			'--media-menu-top-bar-bg',
			currentTheme['--surface']
		);
		document.documentElement.style.setProperty(
			'--media-menu-text-color',
			currentTheme['--on-background']
		);
		document.documentElement.style.setProperty(
			'--media-menu-item-info-color',
			currentTheme['--on-background']
		);
		document.documentElement.style.setProperty(
			'--media-menu-section-bg',
			currentTheme['--surface']
		);
		document.documentElement.style.setProperty(
			'--media-menu-surface-container',
			currentTheme['--surface']
		);
		document.documentElement.style.setProperty('--audio-bg', currentTheme['--surface']);
	});

	function loadPlayerPos() {
		if (playerPosSet) return;
		playerPosSet = true;
		if (get(playerSavePlaybackPosition)) {
			try {
				const playerPos = localStorage.getItem(`v_${data.video.videoId}`);
				if (playerPos) {
					player.currentTime = Number(playerPos);
				}
			} catch {}
		}
	}

	function savePlayerPos() {
		if (data.video.hlsUrl) return;

		try {
			if (get(playerSavePlaybackPosition) && player.currentTime) {
				if (player.currentTime < player.duration - 10 && player.currentTime > 10) {
					localStorage.setItem(`v_${data.video.videoId}`, player.currentTime.toString());
				} else {
					localStorage.removeItem(`v_${data.video.videoId}`);
				}
			}
		} catch {}
	}

	onDestroy(() => {
		savePlayerPos();
		player.destroy();
	});
</script>

{#if audioMode}
	<div style="margin-top: 50vh;"></div>
{/if}

<media-player
	bind:this={player}
	autoPlay={$playerAutoPlay && !isSyncing}
	loop={$playerAlwaysLoop}
	title={data.video.title}
	streamType={playerIsLive ? 'live' : 'on-demand'}
	viewType={audioMode ? 'audio' : 'video'}
	keep-alive
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
		>{$_('skipping')}
		<span class="bold" style="text-transform: capitalize;">{categoryBeingSkipped}</span></span
	>
</div>
