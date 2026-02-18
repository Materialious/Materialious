<script lang="ts">
	import { page } from '$app/stores';
	import { getBestThumbnail } from '$lib/images';
	import { videoLength } from '$lib/numbers';
	import { generateChapterWebVTT, type ParsedDescription } from '$lib/description';
	import { Capacitor, SystemBars, SystemBarsStyle, SystemBarType } from '@capacitor/core';
	import { error, type Page } from '@sveltejs/kit';
	import Mousetrap from 'mousetrap';
	import { CapacitorMusicControls } from 'capacitor-music-controls-plugin';
	import shaka from 'shaka-player/dist/shaka-player.ui';
	import { SponsorBlock, type Category, type Segment } from 'sponsorblock-api';
	import { onDestroy, onMount, tick } from 'svelte';
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import { Slider } from 'melt/builders';
	import { deleteVideoProgress, getVideoProgress, saveVideoProgress } from '$lib/api';
	import type { VideoPlay } from '$lib/api/model';
	import {
		invidiousAuthStore,
		invidiousInstanceStore,
		isAndroidTvStore,
		playerAlwaysLoopStore,
		playerAndroidLockOrientation,
		playerAndroidPauseOnNetworkChange,
		playerAutoPlayStore,
		playerCCByDefault,
		playerDefaultLanguage,
		playerDefaultPlaybackSpeed,
		playerPreferredVolumeStore,
		playerProxyVideosStore,
		playerSavePlaybackPositionStore,
		playerState,
		playertheatreModeIsActive,
		playerYouTubeJsFallback,
		sponsorBlockCategoriesStore,
		sponsorBlockDisplayToastStore,
		sponsorBlockStore,
		sponsorBlockUrlStore,
		synciousInstanceStore,
		synciousStore
	} from '$lib/store';
	import { setStatusBarColor } from '$lib/theme';
	import { getVideoYTjs } from '$lib/api/youtubejs/video';
	import {
		goToNextVideo,
		goToPreviousVideo,
		playerDoubleTapSeek,
		restoreDefaultLanguage,
		restoreQualityPreference,
		toggleSubtitles
	} from '$lib/player/index';
	import { manifestDomainInclusion } from '$lib/player/manifest';
	import { injectSabr } from '$lib/player/sabr';
	import type { SabrStreamingAdapter } from 'googlevideo/sabr-streaming-adapter';
	import { fade } from 'svelte/transition';
	import { addToast } from '$lib/components/Toast.svelte';
	import { getPublicEnv, isMobile, isUnrestrictedPlatform, isYTBackend } from '$lib/misc';
	import { isOwnBackend } from '$lib/shared';
	import Settings from './settings/Settings.svelte';
	import CaptionSettings from './settings/CaptionSettings.svelte';
	import Airplay from './settings/Airplay.svelte';
	import Pip from './settings/Pip.svelte';
	import FullscreenToggle from './settings/FullscreenToggle.svelte';
	import Timeline from './Timeline.svelte';
	import TouchControls from './TouchControls.svelte';
	import { Network, type ConnectionStatus } from '@capacitor/network';
	import { ScreenOrientation, type ScreenOrientationResult } from '@capacitor/screen-orientation';

	interface Props {
		data: { video: VideoPlay; content: ParsedDescription; playlistId: string | null };
		currentTime?: number;
		userManualSeeking?: boolean;
		isEmbed?: boolean;
		playerElement?: HTMLMediaElement | undefined;
		showControls?: boolean;
	}

	let {
		data,
		isEmbed = false,
		playerElement = $bindable(undefined),
		currentTime = $bindable(0),
		userManualSeeking = $bindable(false),
		showControls = false
	}: Props = $props();

	let segments: Segment[] = $state([]);
	let segmentManualSkip: Segment | undefined = $state();
	let watchProgressInterval: ReturnType<typeof setInterval>;
	let showVideoRetry = $state(false);

	let player: shaka.Player;
	let sabrAdapter: SabrStreamingAdapter | null;

	let androidInitialNetworkStatus: ConnectionStatus | undefined;
	let androidOriginalOrigination: ScreenOrientationResult | undefined;

	let playerContainer: HTMLElement;
	let playerCurrentPlaybackState = $state(false);
	let playerMaxKnownTime = $state(data.video.lengthSeconds);
	let playerIsBuffering = $state(true);
	let playerVolume = $state($playerPreferredVolumeStore);
	let playerVideoEndTimePretty: string = $state('');
	let playerIsFullscreen = $state(false);
	let playerInitalInteract = $state(true);

	const playerVolumeSlider = new Slider({
		onValueChange: (volumeToSet) => {
			if (!playerElement) return;
			showPlayerUI();
			playerElement.volume = volumeToSet;
		},
		value: () => playerVolume,
		max: 1,
		min: 0,
		step: 0.01
	});

	playertheatreModeIsActive.subscribe(async () => {
		await tick();
		updateVideoPlayerHeight();
	});

	function saveVolumePreference() {
		if (!playerElement) return;
		playerVolume = playerElement.volume;
		playerPreferredVolumeStore.set(playerElement.volume);
	}

	function restoreVolumePreference() {
		if (!playerElement) return;
		playerElement.volume = $playerPreferredVolumeStore;
		playerVolume = playerElement.volume;
	}

	function skipSegment(segment: Segment) {
		if (!playerElement) return;

		segmentManualSkip = undefined;

		if (Math.round(playerElement.currentTime) >= Math.round(playerElement.duration)) {
			return;
		}
		playerElement.currentTime = segment.endTime + 1;
		if (!get(sponsorBlockDisplayToastStore)) {
			addToast({
				data: {
					text: `${$_('skipping')} ${segment.category}`
				}
			});
		}
	}

	async function setupSponsorSkip() {
		if (!$sponsorBlockUrlStore || !$sponsorBlockCategoriesStore || !$sponsorBlockStore) return;
		const sponsorBlock = new SponsorBlock('', { baseURL: $sponsorBlockUrlStore });

		const sponsorBlockCategoryKeys = Object.keys($sponsorBlockCategoriesStore);

		if (sponsorBlockCategoryKeys.length === 0) return;

		try {
			segments = await sponsorBlock.getSegments(
				data.video.videoId,
				sponsorBlockCategoryKeys as Category[]
			);
		} catch (error) {
			console.error('Sponsorskip errored with:', error);
		}

		if (segments.length === 0) return;

		playerElement?.addEventListener('timeupdate', () => {
			segments.forEach((segment) => {
				if (!playerElement) return;

				if (
					playerElement.currentTime >= segment.startTime &&
					playerElement.currentTime <= segment.endTime
				) {
					const segmentTrigger = $sponsorBlockCategoriesStore[segment.category];

					if (segmentTrigger === 'automatic') {
						skipSegment(segment);
					} else if (segmentTrigger === 'manual') {
						if (!segmentManualSkip) {
							addToast({
								data: {
									text: `${$_('upcomingSegment')} ${segment.category}`,
									action: {
										action: () => skipSegment(segment),
										text: $_('skip')
									}
								}
							});
						}
						segmentManualSkip = segment;
					}
				}
			});
		});
	}

	function loadTimeFromUrl(page: Page): boolean {
		if (player) {
			const timeGivenUrl = page.url.searchParams.get('time');
			if (timeGivenUrl && !isNaN(parseFloat(timeGivenUrl))) {
				if (!playerElement) return false;
				playerElement.currentTime = Number(timeGivenUrl);
				return true;
			}
		}

		return false;
	}

	page.subscribe((pageUpdate) => loadTimeFromUrl(pageUpdate));

	function toggleFullscreen() {
		if (document.fullscreenElement) {
			document.exitFullscreen();
			playerIsFullscreen = false;

			setTimeout(() => updateVideoPlayerHeight(), 100);
		} else {
			playerContainer.requestFullscreen();
			playerIsFullscreen = true;
		}
	}

	async function loadVideo() {
		showVideoRetry = false;

		sabrAdapter = await injectSabr(data.video, player);

		if (data.video.fallbackPatch === 'youtubejs' && !isYTBackend()) {
			addToast({ data: { text: $_('player.youtubeJsFallBack') } });
		}

		setupSponsorSkip();

		player.addEventListener('loaded', () => {
			restoreQualityPreference(player);
			restoreDefaultLanguage(player);
			updateVideoPlayerHeight();

			if ($playerCCByDefault) {
				toggleSubtitles(player);
			}
		});

		if (!data.video.liveNow) {
			if (watchProgressInterval) {
				clearInterval(watchProgressInterval);
			}
			// Auto save watch progress every minute.
			watchProgressInterval = setInterval(() => savePlayerPos(), 60000);

			let dashUrl: string;

			// Due to CORs issues with redirects, hosted instances of Materialious
			// dirctly provide the companion instance
			// while clients can just use the reirect provided by Invidious' API
			if (getPublicEnv('DEFAULT_COMPANION_INSTANCE')) {
				dashUrl = `${getPublicEnv('DEFAULT_COMPANION_INSTANCE')}/api/manifest/dash/id/${data.video.videoId}`;
			} else {
				if (!data.video.dashUrl) {
					error(500, 'No dash manifest found');
				}
				dashUrl = data.video.dashUrl;
			}

			if (!data.video.fallbackPatch && (!isUnrestrictedPlatform() || $playerProxyVideosStore)) {
				dashUrl += '?local=true';
			}

			if (
				(Capacitor.getPlatform() === 'android' ||
					(isOwnBackend() && Capacitor.getPlatform() === 'web')) &&
				$playerProxyVideosStore &&
				!data.video.fallbackPatch
			) {
				const manifest = await manifestDomainInclusion(dashUrl);
				await player.load(manifest, await getLastPlayPos());
			} else {
				await player.load(dashUrl, await getLastPlayPos());
			}

			if (data.video.captions) {
				for (const caption of data.video.captions) {
					let captionUrl: string;
					if (!getPublicEnv('DEFAULT_COMPANION_INSTANCE') && $invidiousInstanceStore) {
						captionUrl = caption.url.startsWith('http')
							? caption.url
							: `${new URL($invidiousInstanceStore).origin}${caption.url}`;
					} else {
						captionUrl = `${getPublicEnv('DEFAULT_COMPANION_INSTANCE')}${caption.url}`;
					}

					await player.addTextTrackAsync(
						captionUrl,
						caption.language_code,
						'captions',
						undefined,
						undefined,
						caption.label
					);
				}
			}

			if (data.content.timestamps) {
				try {
					player.addChaptersTrack(
						`data:text/vtt;base64,${btoa(generateChapterWebVTT(data.content.timestamps, playerMaxKnownTime))}`,
						get(playerDefaultLanguage)
					);
				} catch {
					// Continue regardless
				}
			}
		} else {
			if (data.video.fallbackPatch === 'youtubejs') {
				if (!data.video.dashUrl) {
					error(500, 'No dash manifest found');
					return;
				}
				await player.load(data.video.dashUrl);
			} else {
				await player.load(data.video.hlsUrl + '?local=true');
			}
		}

		if ($playerDefaultPlaybackSpeed && playerElement) {
			playerElement.playbackRate = $playerDefaultPlaybackSpeed;
		}
	}

	async function reloadVideo() {
		showVideoRetry = false;
		data.video = await getVideoYTjs(data.video.videoId);
		await loadVideo();
	}

	function toggleVideoPlaybackStatus() {
		if (playerCurrentPlaybackState) {
			playerElement?.pause();
		} else {
			playerElement?.play();
		}
	}

	// Due to how our player is rendered in layout for stateful pip
	// we calaculate player height to then allow children pages
	// to wrap around it.
	function updateVideoPlayerHeight() {
		if (!playerContainer) {
			return;
		}

		const height = playerContainer.getBoundingClientRect().height;
		document.documentElement.style.setProperty('--video-player-height', `${height + 10}px`);
	}

	let showPlayerUiTimeout: ReturnType<typeof setTimeout>;
	function showPlayerUI() {
		showControls = true;

		if (showPlayerUiTimeout) clearTimeout(showPlayerUiTimeout);

		showPlayerUiTimeout = setTimeout(() => {
			showControls = false;
			playerInitalInteract = true;
		}, 5000);
	}

	async function onAndroidFullscreenChange() {
		const videoFormats = data.video.adaptiveFormats.filter((format) =>
			format.type.startsWith('video/')
		);

		const isFullScreen = !!document.fullscreenElement;

		if (isFullScreen) {
			// Ensure bar color is black while in fullscreen
			await SystemBars.setStyle({ style: SystemBarsStyle.Light });
			await SystemBars.hide({
				bar: SystemBarType.NavigationBar
			});
			await SystemBars.hide({
				bar: SystemBarType.StatusBar
			});
		} else {
			await setStatusBarColor();
		}

		if (!$playerAndroidLockOrientation) return;

		if (isFullScreen && videoFormats[0].resolution) {
			const widthHeight = videoFormats[0].resolution.split('x');

			if (widthHeight.length !== 2) return;

			if (Number(widthHeight[0]) > Number(widthHeight[1])) {
				await ScreenOrientation.lock({ orientation: 'landscape' });
			} else {
				await ScreenOrientation.lock({ orientation: 'portrait' });
			}
		} else {
			await ScreenOrientation.lock({
				orientation: (androidOriginalOrigination as ScreenOrientationResult).type
			});
		}
	}

	async function androidHandleRotate() {
		if (
			Capacitor.getPlatform() !== 'android' ||
			data.video.adaptiveFormats.length === 0 ||
			$isAndroidTvStore
		)
			return;

		androidOriginalOrigination = await ScreenOrientation.orientation();

		document.addEventListener('fullscreenchange', onAndroidFullscreenChange);
	}

	onMount(async () => {
		shaka.polyfill.installAll();
		if (!shaka.Player.isBrowserSupported()) {
			addToast({
				data: {
					text: 'Browser not supported for playback.'
				}
			});
			return;
		}

		player = new shaka.Player();

		player.configure({
			abr: {
				enabled: true
			},
			streaming: {
				failureCallback: (error: shaka.util.Error) => {
					console.error('Streaming failure:', error);
					player.retryStreaming(5);
				},
				bufferingGoal: 120,
				rebufferingGoal: 2,
				bufferBehind: 300,
				retryParameters: {
					maxAttempts: 8,
					fuzzFactor: 0.5,
					timeout: 30 * 1000
				}
			}
		});
		playerElement = document.getElementById('player') as HTMLMediaElement;

		playerElement.loop = $playerAlwaysLoopStore;

		if ($playerState) {
			playerState.set({ ...$playerState, playerElement: playerElement });
		}

		// Change instantly to stop video from being loud for a second
		restoreVolumePreference();

		playerContainer = document.getElementById('player-container') as HTMLElement;

		window.addEventListener('resize', updateVideoPlayerHeight);
		updateVideoPlayerHeight();

		await player.attach(playerElement);

		player?.addEventListener('error', (event) => {
			const error = (event as CustomEvent).detail as shaka.util.Error;
			console.error('Player error:', error);
		});
		player.getNetworkingEngine()?.registerResponseFilter((type, response) => {
			if (
				type !== shaka.net.NetworkingEngine.RequestType.SEGMENT ||
				!response.uri.includes('/api/timedtext')
			) {
				return;
			}

			const url = new URL(response.uri);

			// Fix positioning for auto-generated subtitles
			// Credit to Freetube!
			if (
				url.hostname.endsWith('.youtube.com') &&
				url.pathname === '/api/timedtext' &&
				url.searchParams.get('caps') === 'asr' &&
				url.searchParams.get('kind') === 'asr' &&
				url.searchParams.get('fmt') === 'vtt'
			) {
				const stringBody = new TextDecoder().decode(response.data);
				// position:0% for LTR text and position:100% for RTL text
				const cleaned = stringBody.replaceAll(/ align:start position:(?:10)?0%$/gm, '');
				response.data = new TextEncoder().encode(cleaned).buffer;
			}
		});

		playerElement?.addEventListener('volumechange', saveVolumePreference);

		if (Capacitor.getPlatform() === 'android') {
			await androidHandleRotate();

			androidInitialNetworkStatus = await Network.getStatus();

			Network.addListener('networkStatusChange', (networkStatus) => {
				if (
					androidInitialNetworkStatus?.connectionType !== networkStatus.connectionType &&
					$playerAndroidPauseOnNetworkChange
				) {
					playerElement?.pause();
				}
			});

			await CapacitorMusicControls.create({
				track: data.video.title,
				artist: data.video.author,
				cover: getBestThumbnail(data.video.videoThumbnails, 800, 800),
				hasPrev: data.playlistId !== null,
				hasNext: data.playlistId !== null,
				isPlaying: true,
				hasClose: true,
				dismissable: true,
				playIcon: '',
				pauseIcon: '',
				prevIcon: '',
				nextIcon: '',
				closeIcon: '',
				notificationIcon: '',
				ticker: `Now playing "${data.video.title}"`
			});

			// @ts-expect-error: Is handle correctly via https://github.com/ingageco/capacitor-music-controls-plugin
			document.addEventListener('controlsNotification', (event: { message: string }) => {
				if (
					event.message === 'music-controls-headset-unplugged' ||
					event.message === 'music-controls-pause'
				) {
					playerElement?.pause();
					return;
				} else if (event.message === 'music-controls-play') {
					playerElement?.play();
					return;
				}

				if (data.playlistId) {
					if (event.message === 'music-controls-next') {
						goToNextVideo(data.video, data.playlistId);
					} else if (event.message === 'music-controls-previous') {
						goToPreviousVideo(data.playlistId);
					}
				}
			});

			playerElement?.addEventListener('play', () => {
				CapacitorMusicControls.updateIsPlaying({ isPlaying: true });
			});

			playerElement?.addEventListener('pause', () => {
				CapacitorMusicControls.updateIsPlaying({ isPlaying: false });
			});
		} else if ('mediaSession' in navigator) {
			const metadataArtwork: MediaImage[] = [];
			data.video.videoThumbnails.forEach((thumbnail) => {
				metadataArtwork.push({
					type: 'image/jpeg',
					sizes: `${thumbnail.width}x${thumbnail.height}`,
					src: thumbnail.url
				});
			});

			navigator.mediaSession.metadata = new MediaMetadata({
				title: data.video.title,
				artist: data.video.author,
				artwork: metadataArtwork
			});

			navigator.mediaSession.setActionHandler('play', () => playerElement?.play());

			navigator.mediaSession.setActionHandler('pause', () => playerElement?.pause());

			navigator.mediaSession.setActionHandler('seekbackward', (details) => {
				if (!playerElement) return;

				playerElement.currentTime = Math.max(
					playerElement.currentTime - (details.seekOffset || 10),
					0
				);
			});

			navigator.mediaSession.setActionHandler('seekforward', (details) => {
				if (!playerElement) return;

				playerElement.currentTime = Math.min(
					playerElement.currentTime + (details.seekOffset || 10),
					playerElement.duration
				);
			});

			navigator.mediaSession.setActionHandler('seekto', (details) => {
				if (!playerElement) return;

				if (details.fastSeek && 'fastSeek' in playerElement) {
					playerElement.fastSeek(details.seekTime ?? 0);
				} else {
					playerElement.currentTime = details.seekTime ?? 0;
				}
			});

			navigator.mediaSession.setActionHandler('stop', () => {
				if (!playerElement) return;
				playerElement.pause();
				playerElement.currentTime = 0;
			});

			if (data.playlistId) {
				navigator.mediaSession.setActionHandler('previoustrack', () => {
					goToPreviousVideo(data.playlistId);
				});

				navigator.mediaSession.setActionHandler('nexttrack', async () => {
					await goToNextVideo(data.video, data.playlistId);
				});
			}
		}

		Mousetrap.bind('space', () => {
			if (!playerElement) return;

			if (playerElement.paused) {
				playerElement.play();
			} else {
				playerElement.pause();
			}

			showPlayerUI();

			return false;
		});

		if (!$isAndroidTvStore) {
			Mousetrap.bind('right', () => {
				if (!playerElement) return;
				playerElement.currentTime = playerElement.currentTime + playerDoubleTapSeek;
				showPlayerUI();
				return false;
			});

			Mousetrap.bind('left', () => {
				if (!playerElement) return;
				playerElement.currentTime = playerElement.currentTime - playerDoubleTapSeek;
				showPlayerUI();
				return false;
			});

			Mousetrap.bind('enter', () => {
				if (segmentManualSkip) {
					skipSegment(segmentManualSkip);
					showPlayerUI();
				}
			});
		}

		Mousetrap.bind('c', () => {
			toggleSubtitles(player);
			showPlayerUI();
			return false;
		});

		Mousetrap.bind('f', () => {
			toggleFullscreen();
			showPlayerUI();
			return false;
		});

		Mousetrap.bind('shift+left', () => {
			if (!playerElement) return;
			playerElement.playbackRate = playerElement.playbackRate - 0.25;
			showPlayerUI();
			return false;
		});

		Mousetrap.bind('shift+right', () => {
			if (!playerElement) return;
			playerElement.playbackRate = playerElement.playbackRate + 0.25;
			showPlayerUI();
			return false;
		});

		Mousetrap.bind(',', () => {
			if (!playerElement) return;

			const currentTrack = player.getVariantTracks().find((track) => track.active);
			const frameTime = 1 / (currentTrack?.frameRate || 30);
			playerElement.currentTime -= frameTime;

			showPlayerUI();
		});

		Mousetrap.bind('.', () => {
			if (!playerElement) return;

			const currentTrack = player.getVariantTracks().find((track) => track.active);
			const frameTime = 1 / (currentTrack?.frameRate || 30);
			playerElement.currentTime += frameTime;

			showPlayerUI();
		});

		playerElement?.addEventListener('pause', async () => {
			playerCurrentPlaybackState = false;
			playerIsBuffering = false;
			savePlayerPos();
			showPlayerUI();
		});

		playerElement?.addEventListener('ended', async () => {
			playerCurrentPlaybackState = false;
			playerIsBuffering = false;
			await goToNextVideo(data.video, data.playlistId);
		});

		playerElement?.addEventListener('playing', () => {
			playerCurrentPlaybackState = true;
			playerIsBuffering = false;
		});

		playerElement?.addEventListener('waiting', () => {
			playerCurrentPlaybackState = false;
			playerIsBuffering = true;
			showPlayerUI();
		});

		playerElement?.addEventListener('timeupdate', () => {
			if (!playerElement) return;

			if (!userManualSeeking) {
				currentTime = playerElement.currentTime ?? 0;
			}

			if (playerMaxKnownTime === 0 || currentTime > playerMaxKnownTime) {
				playerMaxKnownTime = Number(playerElement.currentTime);
			}

			const remainingTime = playerMaxKnownTime - playerElement.currentTime;
			const videoEnds = new Date(Date.now() + remainingTime * 1000);

			playerVideoEndTimePretty = videoEnds.toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
				hour12: true
			});
		});

		try {
			await loadVideo();
		} catch (error: unknown) {
			console.error(error);

			if (
				!isUnrestrictedPlatform() ||
				data.video.fallbackPatch === 'youtubejs' ||
				(error as shaka.extern.Error).code !== 1001
			)
				return;

			showVideoRetry = true;
			if ($playerYouTubeJsFallback) {
				await reloadVideo();
			}
		}

		// Update video player height again on video loaded.
		updateVideoPlayerHeight();
	});

	async function getLastPlayPos(): Promise<number> {
		if (loadTimeFromUrl($page) || !$playerSavePlaybackPositionStore) return 0;

		let toSetTime = 0;

		try {
			const playerPos = localStorage.getItem(`v_${data.video.videoId}`);
			if (playerPos && Number(playerPos) > toSetTime) {
				toSetTime = Number(playerPos);
			}
		} catch {
			// Continue regardless of error
		}

		if ($synciousStore && $synciousInstanceStore && $invidiousAuthStore) {
			try {
				toSetTime = (await getVideoProgress(data.video.videoId))[0].time;
			} catch {
				// Continue regardless of error
			}
		}

		return toSetTime;
	}

	function savePlayerPos() {
		if (data.video.liveNow) return;

		const synciousEnabled = $synciousStore && $synciousInstanceStore && $invidiousAuthStore;

		if ($playerSavePlaybackPositionStore && playerElement) {
			if (
				playerElement.currentTime < playerElement.duration - 10 &&
				playerElement.currentTime > 10
			) {
				try {
					localStorage.setItem(`v_${data.video.videoId}`, playerElement.currentTime.toString());
				} catch {
					// Continue regardless of error
				}

				if (synciousEnabled) {
					saveVideoProgress(data.video.videoId, playerElement.currentTime);
				}
			} else {
				try {
					localStorage.removeItem(`v_${data.video.videoId}`);
				} catch {
					// Continue regardless of error
				}

				if (synciousEnabled) {
					deleteVideoProgress(data.video.videoId);
				}
			}
		}
	}

	onDestroy(async () => {
		if (Capacitor.getPlatform() === 'android') {
			await setStatusBarColor();
			await CapacitorMusicControls.destroy();

			if ($isAndroidTvStore) {
				document.removeEventListener('fullscreenchange', onAndroidFullscreenChange);
			}

			if (androidOriginalOrigination) {
				await ScreenOrientation.lock({
					orientation: androidOriginalOrigination.type
				});
			}
		}

		try {
			savePlayerPos();
		} catch {
			// Continue regardless of error
		}

		window.removeEventListener('resize', updateVideoPlayerHeight);

		Mousetrap.unbind(['left', 'right', 'space', 'c', 'f', 'shift+left', 'shift+right', 'enter']);

		if (watchProgressInterval) clearInterval(watchProgressInterval);
		if (sabrAdapter) sabrAdapter.dispose();
		if (showPlayerUiTimeout) clearTimeout(showPlayerUiTimeout);

		if (player) {
			player.unload();
			player.destroy();
		}
	});
</script>

<div
	id="player-container"
	class:contain-video={!$isAndroidTvStore}
	class:tv-contain-video={$isAndroidTvStore}
	class:hide={showVideoRetry}
	class:hide-cursor={!showControls}
	role="presentation"
	onmouseenter={showPlayerUI}
	onmousemove={showPlayerUI}
	onscroll={showPlayerUI}
	onmouseleave={() => {
		showControls = false;
		playerInitalInteract = true;
	}}
	bind:this={playerContainer}
>
	<video
		controls={false}
		autoplay={$playerAutoPlayStore}
		id="player"
		poster={getBestThumbnail(data.video.videoThumbnails, 9999, 9999)}
	></video>
	{#if isEmbed && !$isAndroidTvStore}
		<div class="chip blur embed" style="position: absolute;top: 10px;left: 10px;font-size: 18px;">
			{data.video.title}
		</div>
	{/if}
	{#if showControls}
		<div id="mobile-time" transition:fade>
			<p class="chip surface-container-highest s">
				{#if data.video.liveNow}
					{$_('thumbnail.live')}
				{:else}
					{videoLength(currentTime)} / {videoLength(playerMaxKnownTime)}
				{/if}
			</p>
			<p class="chip surface-container-highest">
				{playerVideoEndTimePretty}
			</p>
		</div>
	{/if}
	<TouchControls
		{playerElement}
		{showPlayerUI}
		{toggleVideoPlaybackStatus}
		{toggleFullscreen}
		bind:playerInitalInteract
		bind:playerMaxKnownTime
		bind:playerIsBuffering
	/>
	{#if showControls}
		<div id="player-controls" transition:fade>
			<Timeline
				{playerElement}
				{currentTime}
				{showPlayerUI}
				{segments}
				video={data.video}
				content={data.content}
				bind:userManualSeeking
				bind:playerMaxKnownTime
			/>
			<nav>
				{#if !$isAndroidTvStore}
					<nav class="no-wrap">
						<button class="surface-container-highest" onclick={toggleVideoPlaybackStatus}>
							<i>
								{#if playerCurrentPlaybackState}
									pause
								{:else}
									play_arrow
								{/if}
							</i>
						</button>
						{#if !isMobile()}
							<div class="player-slider volume m l" {...playerVolumeSlider.root}>
								<div class="track">
									<div class="range"></div>
									<div {...playerVolumeSlider.thumb}></div>
								</div>
							</div>
						{/if}
					</nav>
				{/if}

				<div class="max"></div>

				<nav class="no-wrap">
					<p class="chip m l" style="height: 100%;">
						{#if data.video.liveNow}
							{$_('thumbnail.live')}
						{:else}
							{videoLength(currentTime)} / {videoLength(data.video.lengthSeconds)}
						{/if}
					</p>
					{#if !$isAndroidTvStore}
						<CaptionSettings {player} video={data.video} />
						{#if playerElement}
							<Settings {player} {playerElement} />
							<Airplay {playerElement} />
							<Pip {playerElement} />
						{/if}
						<FullscreenToggle {toggleFullscreen} {playerIsFullscreen} />
					{/if}
				</nav>
			</nav>
		</div>
	{/if}
</div>

{#if showVideoRetry}
	<article class="video-placeholder">
		{#if $playerYouTubeJsFallback}
			<p>{$_('player.youtubeJsLoading')}</p>
			<progress class="circle large"></progress>
		{:else}
			<p>{$_('player.retryText')}</p>
			<button onclick={reloadVideo}>{$_('player.enableYoutubejsTemp')}</button>
			<div class="space"></div>
			<button
				class="border"
				onclick={async () => {
					playerYouTubeJsFallback.set(true);
					await reloadVideo();
				}}>{$_('player.enableYoutubejsPerm')}</button
			>
		{/if}
	</article>
{/if}

<style>
	#player-container {
		position: relative;
		width: 100%;
	}

	#player-controls {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 10px;
	}

	#mobile-time {
		position: absolute;
		top: 0;
		right: 0;
		padding: 10px;
	}

	#mobile-time .chip {
		border: none;
		margin: 0;
	}

	.contain-video {
		max-height: 80vh;
		max-width: calc(80vh * 16 / 9);
		overflow: hidden;
		position: relative;
		flex: 1;
		background-color: black;
		aspect-ratio: 16 / 9;
	}

	.tv-contain-video {
		height: 100vh;
		width: calc(100vh * 16 / 9);
		max-width: 100vw;
		max-height: 100vh;
		overflow: hidden;
		position: relative;
		flex: 1;
		background-color: black;
		aspect-ratio: 16 / 9;
	}

	video[poster] {
		height: 100%;
		width: 100%;
	}

	video {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		max-height: 100%;
		max-width: 100%;
		object-fit: contain;
		background-color: black;
	}

	.chip {
		background-color: var(--surface-container-highest);
		color: var(--on-surface);
		border: none;
	}

	.hide-cursor {
		cursor: none;
	}
</style>
