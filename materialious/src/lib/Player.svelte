<script lang="ts">
	import 'vidstack/bundle';

	import { page } from '$app/stores';
	import { Capacitor } from '@capacitor/core';
	import type { Page } from '@sveltejs/kit';
	import { SponsorBlock, type Category } from 'sponsorblock-api';
	import { onDestroy, onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import type { MediaTimeUpdateEvent, PlayerSrc, VideoSrc } from 'vidstack';
	import type { MediaPlayerElement } from 'vidstack/elements';
	import { deleteVideoProgress, getVideoProgress, saveVideoProgress } from './Api';
	import type { VideoPlay } from './Api/model';
	import { getBestThumbnail, proxyVideoUrl, videoLength, type PhasedDescription } from './misc';
	import {
		authStore,
		instanceStore,
		miniPlayerSrcStore,
		playerAlwaysLoopStore,
		playerAutoPlayStore,
		playerDashStore,
		playerProxyVideosStore,
		playerSavePlaybackPositionStore,
		sponsorBlockCategoriesStore,
		sponsorBlockStore,
		sponsorBlockUrlStore,
		synciousStore
	} from './store';
	import { getDynamicTheme } from './theme';

	export let data: { video: VideoPlay; content: PhasedDescription; playlistId: string | null };
	export let audioMode = false;
	export let player: MediaPlayerElement;
	export let isSyncing: boolean = false;
	export let isEmbed: boolean = false;

	let src: PlayerSrc = [];
	let categoryBeingSkipped = '';
	let playerIsLive = false;
	let playerPosSet = false;

	function loadTimeFromUrl(page: Page): boolean {
		if (player) {
			const timeGivenUrl = page.url.searchParams.get('time');
			if (timeGivenUrl && !isNaN(parseFloat(timeGivenUrl))) {
				player.currentTime = Number(timeGivenUrl);
				return true;
			}
		}

		return false;
	}

	page.subscribe((pageUpdate) => loadTimeFromUrl(pageUpdate));

	const proxyVideos = get(playerProxyVideosStore);

	onMount(async () => {
		miniPlayerSrcStore.set(null);

		if (!data.video.hlsUrl) {
			playerIsLive = false;
			if (data.video.captions) {
				data.video.captions.forEach(async (caption) => {
					player.textTracks.add({
						label: caption.label,
						kind: 'captions',
						language: caption.language_code,
						src: `${get(instanceStore)}${caption.url}`
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

			player.addEventListener('end', () => {
				savePlayerPos();
			});

			if (get(sponsorBlockStore) && get(sponsorBlockCategoriesStore)) {
				const currentCategories = get(sponsorBlockCategoriesStore);

				const sponsorBlockUrl = get(sponsorBlockUrlStore);

				if (currentCategories.length > 0 && sponsorBlockUrl && sponsorBlockUrl !== '') {
					const sponsorBlock = new SponsorBlock('', { baseURL: sponsorBlockUrl });

					try {
						const segments = await sponsorBlock.getSegments(
							data.video.videoId,
							get(sponsorBlockCategoriesStore) as Category[]
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

			if (get(playerDashStore)) {
				src = [{ src: data.video.dashUrl, type: 'application/dash+xml' }];

				if (Capacitor.getPlatform() !== 'electron' || proxyVideos) {
					(src[0] as { src: string }).src += '?local=true';
				}

				player.addEventListener('dash-can-play', async () => {
					await loadPlayerPos();
				});
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
				}) as VideoSrc[];

				await loadPlayerPos();
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

	async function loadPlayerPos() {
		if (playerPosSet) return;
		playerPosSet = true;

		if (loadTimeFromUrl($page)) return;

		let toSetTime = 0;

		if (get(synciousStore) && get(authStore)) {
			try {
				toSetTime = (await getVideoProgress(data.video.videoId))[0].time;
			} catch {}
		}

		if (get(playerSavePlaybackPositionStore)) {
			try {
				const playerPos = localStorage.getItem(`v_${data.video.videoId}`);
				if (playerPos && Number(playerPos) > toSetTime) {
					toSetTime = Number(playerPos);
				}
			} catch {}
		}

		if (toSetTime > 0) player.currentTime = toSetTime;
	}

	function savePlayerPos() {
		if (data.video.hlsUrl) return;

		if (get(playerSavePlaybackPositionStore) && player.currentTime) {
			if (player.currentTime < player.duration - 10 && player.currentTime > 10) {
				try {
					localStorage.setItem(`v_${data.video.videoId}`, player.currentTime.toString());
				} catch {}

				if (get(synciousStore) && get(authStore)) {
					saveVideoProgress(data.video.videoId, player.currentTime);
				}
			} else {
				try {
					localStorage.removeItem(`v_${data.video.videoId}`);
				} catch {}

				if (get(synciousStore) && get(authStore)) {
					deleteVideoProgress(data.video.videoId);
				}
			}
		}
	}

	onDestroy(() => {
		savePlayerPos();
		player.pause();
		player.destroy();
		playerPosSet = false;
	});
</script>

{#if audioMode}
	<div style="margin-top: 40vh;"></div>
{/if}

<media-player
	bind:this={player}
	autoPlay={$playerAutoPlayStore && !isSyncing}
	loop={$playerAlwaysLoopStore}
	title={data.video.title}
	streamType={playerIsLive ? 'live' : 'on-demand'}
	viewType={audioMode ? 'audio' : 'video'}
	keep-alive
	{src}
>
	<media-provider>
		{#if !audioMode}
			<media-poster class="vds-poster" src={getBestThumbnail(data.video.videoThumbnails, 1251, 781)}
			></media-poster>
		{/if}
	</media-provider>
	<media-audio-layout></media-audio-layout>
	{#if data.video.storyboards && data.video.storyboards.length > 3}
		<media-video-layout thumbnails={`${get(instanceStore)}${data.video.storyboards[3].url}`}
		></media-video-layout>
	{:else}
		<media-video-layout></media-video-layout>
	{/if}
</media-player>

{#if !isEmbed}
	<div class="snackbar" id="sponsorblock-alert">
		<span
			>{$_('skipping')}
			<span class="bold" style="text-transform: capitalize;">{categoryBeingSkipped}</span></span
		>
	</div>
{/if}
