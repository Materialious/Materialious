<script lang="ts">
	import 'vidstack/bundle';

	import { page } from '$app/stores';
	import { getBestThumbnail } from '$lib/images';
	import { padTime, videoLength } from '$lib/time';
	import { Capacitor } from '@capacitor/core';
	import { ScreenOrientation, type ScreenOrientationResult } from '@capacitor/screen-orientation';
	import { StatusBar, Style } from '@capacitor/status-bar';
	import { NavigationBar } from '@hugotomazi/capacitor-navigation-bar';
	import { AudioPlayer } from '@mediagrid/capacitor-native-audio';
	import type { Page } from '@sveltejs/kit';
	import { SponsorBlock, type Category, type Segment } from 'sponsorblock-api';
	import { onDestroy, onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import type { FullscreenChangeEvent, MediaTimeUpdateEvent, PlayerSrc } from 'vidstack';
	import type { MediaPlayerElement } from 'vidstack/elements';
	import { deleteVideoProgress, getVideoProgress, saveVideoProgress } from '../api';
	import type { VideoPlay } from '../api/model';
	import { proxyVideoUrl, pullBitratePreference, type PhasedDescription } from '../misc';
	import {
		authStore,
		instanceStore,
		playerAlwaysLoopStore,
		playerAndroidBgPlayer,
		playerAndroidLockOrientation,
		playerAutoPlayStore,
		playerDefaultLanguage,
		playerProxyVideosStore,
		playerSavePlaybackPositionStore,
		sponsorBlockCategoriesStore,
		sponsorBlockDisplayToastStore,
		sponsorBlockStore,
		sponsorBlockTimelineStore,
		sponsorBlockUrlStore,
		synciousInstanceStore,
		synciousStore
	} from '../store';
	import { getDynamicTheme, setStatusBarColor } from '../theme';

	interface Props {
		data: { video: VideoPlay; content: PhasedDescription; playlistId: string | null };
		audioMode?: boolean;
		player: MediaPlayerElement;
		isSyncing?: boolean;
		isEmbed?: boolean;
		segments?: Segment[];
	}

	let {
		data,
		audioMode = false,
		player = $bindable(),
		isSyncing = false,
		isEmbed = false,
		segments = $bindable([])
	}: Props = $props();

	let src: PlayerSrc = $state([]);
	let snackBarAlert = $state('');
	let playerIsLive = $state(false);
	let playerPosSet = false;
	let originalOrigination: ScreenOrientationResult | undefined;
	let sponsorBlockElements: Element[] = [];
	let watchProgressTimeout: NodeJS.Timeout;

	function setSponsorTimeline() {
		if (get(sponsorBlockTimelineStore)) return;
		if (segments.length === 0) return;

		const timeline = document.getElementsByClassName('vds-time-slider')[0];

		if (sponsorBlockElements.length > 0) {
			sponsorBlockElements.forEach((barDiv) => {
				if (timeline.contains(barDiv)) {
					timeline.removeChild(barDiv);
				}
			});
		}

		const segmentColors = {
			sponsor: '00d400',
			selfpromo: 'ffff00',
			interaction: 'cc00ff',
			intro: '00ffff',
			outro: '0202ed',
			preview: '008fd6',
			music_offtopic: 'ff9900',
			filler: '7300FF'
		};

		segments.forEach((segment) => {
			const startPercent = (segment.startTime / data.video.lengthSeconds) * 100;
			const endPercent = (segment.endTime / data.video.lengthSeconds) * 100;
			const widthPercent = endPercent - startPercent;

			const barDiv = document.createElement('div');
			barDiv.classList.add('sponsorskip-bar');
			barDiv.style.left = `${startPercent}%`;
			barDiv.style.width = `${widthPercent}%`;
			barDiv.style.backgroundColor =
				segment.category in segmentColors ? `#${segmentColors[segment.category]}` : 'grey';

			timeline.appendChild(barDiv);
			sponsorBlockElements.push(barDiv);
		});
	}

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
		if (!data.video.hlsUrl) {
			playerIsLive = false;
			if (data.video.captions) {
				data.video.captions.forEach(async (caption) => {
					player.textTracks.add({
						label: caption.label,
						kind: 'captions',
						language: caption.language_code,
						// Need if captions are generated when youtube.js is being used.
						src: caption.url.startsWith('http')
							? caption.url
							: `${get(instanceStore)}${caption.url}`
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

					chapterWebVTT += `${padTime(timestamp.timePretty)} --> ${padTime(endTime)}\n${timestamp.title.replaceAll('-', '').trim()}\n\n`;

					timestampIndex += 1;
				});

				if (timestampIndex > 0) {
					player.textTracks.add({
						kind: 'chapters',
						src: URL.createObjectURL(new Blob([chapterWebVTT])),
						default: true
					});
				}
			}

			// Auto save watch progress every minute.
			watchProgressTimeout = setInterval(() => savePlayerPos(), 60000);

			player.addEventListener('provider-change', (event) => {
				const provider = event.detail as any;
				if (provider?.type === 'dash') {
					const bitrate = pullBitratePreference();
					const instanceDefaultBitrate = import.meta.env.VITE_DEFAULT_DASH_BITRATE
						? Number(import.meta.env.VITE_DEFAULT_DASH_BITRATE)
						: -1;
					provider.library = () => import('dashjs');
					provider.config = {
						streaming: {
							abr: {
								ABRStrategy: 'abrBola',
								movingAverageMethod: 'ewma',
								autoSwitchBitrate: {
									video: false,
									audio: false
								},
								initialBitrate: {
									video: bitrate === -1 ? instanceDefaultBitrate : bitrate,
									audio: bitrate === -1 ? instanceDefaultBitrate : bitrate
								}
							}
						}
					};
				}
			});

			if (get(sponsorBlockStore) && get(sponsorBlockCategoriesStore)) {
				const currentCategories = get(sponsorBlockCategoriesStore);

				const sponsorBlockUrl = get(sponsorBlockUrlStore);

				if (currentCategories.length > 0 && sponsorBlockUrl && sponsorBlockUrl !== '') {
					const sponsorBlock = new SponsorBlock('', { baseURL: sponsorBlockUrl });

					try {
						segments = await sponsorBlock.getSegments(
							data.video.videoId,
							get(sponsorBlockCategoriesStore) as Category[]
						);

						setSponsorTimeline();

						addEventListener('resize', () => {
							setSponsorTimeline();
						});

						player.addEventListener('time-update', (event: MediaTimeUpdateEvent) => {
							segments.forEach((segment) => {
								if (
									event.detail.currentTime >= segment.startTime &&
									event.detail.currentTime <= segment.endTime
								) {
									if (Math.round(player.currentTime) >= Math.round(player.duration)) {
										return;
									}
									player.currentTime = segment.endTime + 1;
									if (!get(sponsorBlockDisplayToastStore)) {
										snackBarAlert = `${get(_)('skipping')} ${segment.category}`;
										ui('#snackbar-alert');
									}
								}
							});
						});
					} catch {}
				}
			}

			src = [{ src: data.video.dashUrl, type: 'application/dash+xml' }];

			if (!data.video.fallbackPatch) {
				if (!Capacitor.isNativePlatform() || proxyVideos) {
					(src[0] as { src: string }).src += '?local=true';
				}
			}

			player.addEventListener('dash-can-play', async () => {
				await loadPlayerPos();

				const defaultLanguage = get(playerDefaultLanguage);
				if (defaultLanguage) {
					let trackIndex = 0;
					for (const track of player.audioTracks) {
						console.log(player.audioTracks);
						if (track.label.toLowerCase().includes(defaultLanguage)) {
							player.remoteControl.changeAudioTrack(trackIndex);
							break;
						}
						trackIndex++;
					}
				}

				if (get(playerAutoPlayStore)) {
					player.play();
					player.exitFullscreen();
				}
			});

			if (Capacitor.getPlatform() === 'android' && data.video.adaptiveFormats.length > 0) {
				const videoFormats = data.video.adaptiveFormats.filter((format) =>
					format.type.startsWith('video/')
				);

				originalOrigination = await ScreenOrientation.orientation();

				player.addEventListener('fullscreen-change', async (event: FullscreenChangeEvent) => {
					if (event.detail) {
						// Ensure bar color is black while in fullscreen
						await StatusBar.setBackgroundColor({ color: '#000000' });
						await NavigationBar.setColor({
							color: '#000000'
						});
						await StatusBar.setStyle({ style: Style.Dark });
					} else {
						await setStatusBarColor();
					}

					if (!get(playerAndroidLockOrientation)) return;

					if (event.detail && videoFormats[0].resolution) {
						const widthHeight = videoFormats[0].resolution.split('x');

						if (widthHeight.length !== 2) return;

						if (Number(widthHeight[0]) > Number(widthHeight[1])) {
							await StatusBar.setOverlaysWebView({ overlay: true });
							await StatusBar.hide();
							await NavigationBar.hide();
							await ScreenOrientation.lock({ orientation: 'landscape' });
						} else {
							await ScreenOrientation.lock({ orientation: 'portrait' });
						}
					} else {
						await StatusBar.setOverlaysWebView({ overlay: false });
						await StatusBar.show();
						await NavigationBar.show();

						await ScreenOrientation.lock({
							orientation: (originalOrigination as ScreenOrientationResult).type
						});
					}
				});

				if (data.video.fallbackPatch === undefined && get(playerAndroidBgPlayer)) {
					const highestBitrateAudio = data.video.adaptiveFormats
						.filter((format) => format.type.startsWith('audio/'))
						.reduce((prev, current) => {
							return parseInt(prev.bitrate) > parseInt(current.bitrate) ? prev : current;
						});

					const audioId = { audioId: data.video.videoId };

					let isPlayingInBackground = false;

					await AudioPlayer.create({
						...audioId,
						audioSource: !data.video.fallbackPatch
							? proxyVideoUrl(highestBitrateAudio.url)
							: highestBitrateAudio.url,
						friendlyTitle: data.video.title,
						useForNotification: true,
						loop: player.loop,
						isBackgroundMusic: false
					});

					AudioPlayer.onAppGainsFocus(audioId, async () => {
						if (!isPlayingInBackground) return;

						isPlayingInBackground = false;

						await AudioPlayer.pause(audioId);

						const audioPlayerTime = await AudioPlayer.getCurrentTime(audioId);

						const audioPlayerTimeRounded = Math.round(audioPlayerTime.currentTime);
						if (audioPlayerTimeRounded > player.currentTime) {
							player.currentTime = audioPlayerTimeRounded;
						}

						await player.play();
					});

					AudioPlayer.onAppLosesFocus(audioId, async () => {
						if (player.paused) return;

						isPlayingInBackground = true;
						await AudioPlayer.play(audioId);
						await AudioPlayer.seek({
							...audioId,
							timeInSeconds: Math.round(player.currentTime)
						});
					});

					await AudioPlayer.initialize(audioId);
				}
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

		if (data.video.fallbackPatch === 'youtubejs') {
			snackBarAlert = get(_)('player.youtubeJsFallBack');
			ui('#snackbar-alert');
		}

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

		if (get(synciousStore) && get(synciousInstanceStore) && get(authStore)) {
			try {
				toSetTime = (await getVideoProgress(data.video.videoId))[0].time;
			} catch {}
		} else {
			if (get(playerSavePlaybackPositionStore)) {
				try {
					const playerPos = localStorage.getItem(`v_${data.video.videoId}`);
					if (playerPos && Number(playerPos) > toSetTime) {
						toSetTime = Number(playerPos);
					}
				} catch {}
			}
		}

		if (toSetTime > 0) player.currentTime = toSetTime;
	}

	function savePlayerPos() {
		if (data.video.hlsUrl) return;

		if (get(playerSavePlaybackPositionStore) && player && player.currentTime) {
			if (player.currentTime < player.duration - 10 && player.currentTime > 10) {
				try {
					localStorage.setItem(`v_${data.video.videoId}`, player.currentTime.toString());
				} catch {}

				if (get(synciousStore) && get(synciousInstanceStore) && get(authStore)) {
					saveVideoProgress(data.video.videoId, player.currentTime);
				}
			} else {
				try {
					localStorage.removeItem(`v_${data.video.videoId}`);
				} catch {}

				if (get(synciousStore) && get(synciousInstanceStore) && get(authStore)) {
					deleteVideoProgress(data.video.videoId);
				}
			}
		}
	}

	onDestroy(async () => {
		if (Capacitor.getPlatform() === 'android') {
			await AudioPlayer.destroy({ audioId: data.video.videoId });

			if (originalOrigination) {
				await StatusBar.setOverlaysWebView({ overlay: false });
				await StatusBar.show();
				await ScreenOrientation.lock({
					orientation: originalOrigination.type
				});
			}
		}
		if (watchProgressTimeout) {
			clearTimeout(watchProgressTimeout);
		}
		try {
			savePlayerPos();
		} catch (error) {}
		await player.pause();
		player.destroy();
		playerPosSet = false;
	});
</script>

{#if audioMode}
	<div style="margin-top: 40vh;"></div>
{/if}

<media-player
	bind:this={player}
	id="video"
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
	<div class="snackbar" id="snackbar-alert">
		<span class="bold" style="text-transform: capitalize;">{snackBarAlert}</span>
	</div>
{/if}
