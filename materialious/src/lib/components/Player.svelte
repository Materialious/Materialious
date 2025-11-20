<script lang="ts">
	import { page } from '$app/stores';
	import { getBestThumbnail } from '$lib/images';
	import { padTime, videoLength } from '$lib/numbers';
	import { type PhasedDescription } from '$lib/timestamps';
	import { SafeArea } from '@capacitor-community/safe-area';
	import { Capacitor } from '@capacitor/core';
	import { ScreenOrientation, type ScreenOrientationResult } from '@capacitor/screen-orientation';
	import { error, type Page } from '@sveltejs/kit';
	import ui from 'beercss';
	import ISO6391 from 'iso-639-1';
	import Mousetrap from 'mousetrap';
	import 'shaka-player/dist/controls.css';
	import '$lib/css/shaka-player-theme.css';
	import shaka from 'shaka-player/dist/shaka-player.ui';
	import { SponsorBlock, type Category, type Segment } from 'sponsorblock-api';
	import { onDestroy, onMount, tick } from 'svelte';
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import { deleteVideoProgress, getVideoProgress, saveVideoProgress } from '../api';
	import type { VideoPlay } from '../api/model';
	import {
		authStore,
		darkModeStore,
		instanceStore,
		isAndroidTvStore,
		playerAndroidLockOrientation,
		playerAutoPlayStore,
		playerCCByDefault,
		playerDefaultLanguage,
		playerDefaultPlaybackSpeed,
		playerDefaultQualityStore,
		playerProxyVideosStore,
		playerSavePlaybackPositionStore,
		playerState,
		playerStatisticsByDefault,
		playerYouTubeJsFallback,
		sponsorBlockCategoriesStore,
		sponsorBlockDisplayToastStore,
		sponsorBlockStore,
		sponsorBlockUrlStore,
		synciousInstanceStore,
		synciousStore,
		themeColorStore
	} from '../store';
	import { getDynamicTheme, setStatusBarColor } from '../theme';
	import { patchYoutubeJs } from '$lib/patches/youtubejs';
	import { goToNextVideo, goToPreviousVideo, playbackRates } from '$lib/player';
	import { EndTimeElement } from '$lib/shaka-elements/endTime';
	import { dashManifestDomainInclusion } from '$lib/android/youtube/dash';
	import { injectSabr } from '$lib/sabr';
	import type { SabrStreamingAdapter } from 'googlevideo/sabr-streaming-adapter';

	interface Props {
		data: { video: VideoPlay; content: PhasedDescription; playlistId: string | null };
		isSyncing?: boolean;
		isEmbed?: boolean;
		playerElement?: HTMLMediaElement | undefined;
	}

	let { data, isEmbed = false, playerElement = $bindable(undefined) }: Props = $props();

	let segments: Segment[] = [];

	let snackBarAlert = $state('');
	let originalOrigination: ScreenOrientationResult | undefined;
	let watchProgressTimeout: NodeJS.Timeout;
	let showVideoRetry = $state(false);

	let player: shaka.Player;
	let shakaUi: shaka.ui.Overlay;
	let sabrAdapter: SabrStreamingAdapter | null;

	const STORAGE_KEY_VOLUME = 'shaka-preferred-volume';

	async function updateSeekBarTheme() {
		if (!shakaUi) return;
		await tick();
		shakaUi.configure({
			seekBarColors: {
				played: (await getDynamicTheme())['--primary']
			}
		});
	}

	themeColorStore.subscribe(updateSeekBarTheme);
	darkModeStore.subscribe(updateSeekBarTheme);

	function restoreDefaultLanguage() {
		if (!$playerDefaultLanguage || $playerDefaultLanguage === 'original') {
			const languageAndRole = player
				.getAudioLanguagesAndRoles()
				.find(({ role }) => role === 'main');
			if (languageAndRole !== undefined) {
				player.selectAudioLanguage(languageAndRole.language);
				return;
			}
		} else if ($playerDefaultLanguage) {
			const audioLanguages = player.getAudioLanguages();
			const langCode = ISO6391.getCode($playerDefaultLanguage);

			for (const audioLanguage of audioLanguages) {
				if (audioLanguage.startsWith(langCode)) {
					player.selectAudioLanguage(audioLanguage);
					break;
				}
			}
		}
	}

	function saveVolumePreference() {
		if (!playerElement) return;
		localStorage.setItem(STORAGE_KEY_VOLUME, playerElement.volume.toString());
	}

	function restoreVolumePreference() {
		const savedVolume = localStorage.getItem(STORAGE_KEY_VOLUME);
		if (savedVolume && playerElement) {
			playerElement.volume = parseFloat(savedVolume);
		}
	}

	function restoreQualityPreference() {
		const numericValue = parseInt($playerDefaultQualityStore, 10);

		if (isNaN(numericValue)) {
			player.configure({ abr: { enabled: true } });
			return;
		}

		// Get video-only variant tracks
		const tracks = player.getVariantTracks().filter((t) => t.height !== null);

		// Sort by resolution descending
		const sortedTracks = tracks.sort((a, b) => (b.height as number) - (a.height as number));

		// Try exact match
		let selectedTrack = sortedTracks.find((t) => t.height === numericValue);

		// Try next best (lower than target)
		if (!selectedTrack) {
			selectedTrack = sortedTracks.find((t) => (t.height as number) < numericValue);
		}

		// Try next higher
		if (!selectedTrack) {
			selectedTrack = sortedTracks.find((t) => (t.height as number) > numericValue);
		}

		if (selectedTrack) {
			player.configure({ abr: { enabled: false } });
			player.selectVariantTrack(selectedTrack, true);
		} else {
			player.configure({ abr: { enabled: true } });
		}
	}

	async function androidHandleRotate() {
		if (
			Capacitor.getPlatform() !== 'android' ||
			data.video.adaptiveFormats.length === 0 ||
			$isAndroidTvStore
		)
			return;

		const videoFormats = data.video.adaptiveFormats.filter((format) =>
			format.type.startsWith('video/')
		);

		originalOrigination = await ScreenOrientation.orientation();

		document.addEventListener('fullscreenchange', async () => {
			const isFullScreen = !!document.fullscreenElement;

			if (isFullScreen) {
				// Ensure bar color is black while in fullscreen
				await SafeArea.enable({
					config: {
						customColorsForSystemBars: true,
						statusBarColor: '#00000000',
						statusBarContent: 'light',
						navigationBarColor: '#00000000',
						navigationBarContent: 'light'
					}
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
					orientation: (originalOrigination as ScreenOrientationResult).type
				});
			}
		});
	}

	async function setupSponsorSkip() {
		if (!$sponsorBlockUrlStore || !$sponsorBlockCategoriesStore || !$sponsorBlockStore) return;

		if (
			$sponsorBlockCategoriesStore.length > 0 &&
			$sponsorBlockUrlStore &&
			$sponsorBlockUrlStore !== ''
		) {
			const sponsorBlock = new SponsorBlock('', { baseURL: $sponsorBlockUrlStore });

			try {
				segments = await sponsorBlock.getSegments(
					data.video.videoId,
					$sponsorBlockCategoriesStore as Category[]
				);

				playerElement?.addEventListener('timeupdate', () => {
					segments.forEach((segment) => {
						if (!playerElement) return;

						if (
							playerElement.currentTime >= segment.startTime &&
							playerElement.currentTime <= segment.endTime
						) {
							if (Math.round(playerElement.currentTime) >= Math.round(playerElement.duration)) {
								return;
							}
							playerElement.currentTime = segment.endTime + 1;
							if (!get(sponsorBlockDisplayToastStore)) {
								snackBarAlert = `${get(_)('skipping')} ${segment.category}`;
								ui('#snackbar-alert');
							}
						}
					});
				});
			} catch (error) {
				console.error('Sponsorskip errored with:', error);
			}
		}
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

	function toggleSubtitles() {
		const isVisible = player.isTextTrackVisible();
		if (isVisible) {
			player.setTextTrackVisibility(false);
		} else {
			let langCode: string;
			if ($playerDefaultLanguage === 'original') {
				const languageAndRole = player
					.getAudioLanguagesAndRoles()
					.find(({ role }) => role === 'main');

				if (!languageAndRole) {
					return;
				}

				langCode = languageAndRole.language;
			} else {
				const defaultLanguage = get(playerDefaultLanguage);
				langCode = ISO6391.getCode(defaultLanguage);
			}

			const tracks = player.getTextTracks();

			const subtitleTrack = tracks.find((track) => track.language === langCode);

			if (subtitleTrack) {
				player.selectTextTrack(subtitleTrack);
				player.setTextTrackVisibility(true);
			}
		}
	}

	page.subscribe((pageUpdate) => loadTimeFromUrl(pageUpdate));

	async function loadVideo() {
		showVideoRetry = false;

		sabrAdapter = await injectSabr(data.video, player);

		try {
			document.getElementsByClassName('shaka-ad-info')[0].remove();
		} catch {}

		if (!data.video.liveNow) {
			if (watchProgressTimeout) {
				clearInterval(watchProgressTimeout);
			}
			// Auto save watch progress every minute.
			watchProgressTimeout = setInterval(() => savePlayerPos(), 60000);
			setupSponsorSkip();

			let dashUrl: string;

			// Due to CORs issues with redirects, hosted instances of Materialious
			// dirctly provide the companion instance
			// while clients can just use the reirect provided by Invidious' API
			if (import.meta.env.VITE_DEFAULT_COMPANION_INSTANCE) {
				dashUrl = `${import.meta.env.VITE_DEFAULT_COMPANION_INSTANCE}/api/manifest/dash/id/${data.video.videoId}`;
			} else {
				if (!data.video.dashUrl) {
					error(500, 'No dash manifest found');
				}
				dashUrl = data.video.dashUrl;
			}

			if (!data.video.fallbackPatch && (!Capacitor.isNativePlatform() || $playerProxyVideosStore)) {
				dashUrl += '?local=true';
			}

			if (
				Capacitor.getPlatform() === 'android' &&
				$playerProxyVideosStore &&
				!data.video.fallbackPatch
			) {
				const manifest = await dashManifestDomainInclusion(dashUrl);
				await player.load(manifest, await getLastPlayPos());
			} else {
				await player.load(dashUrl, await getLastPlayPos());
			}

			if (data.video.captions) {
				for (const caption of data.video.captions) {
					let captionUrl: string;
					if (!import.meta.env.VITE_DEFAULT_COMPANION_INSTANCE) {
						captionUrl = caption.url.startsWith('http')
							? caption.url
							: `${new URL(get(instanceStore)).origin}${caption.url}`;
					} else {
						captionUrl = `${import.meta.env.VITE_DEFAULT_COMPANION_INSTANCE}${caption.url}`;
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
				let chapterWebVTT = 'WEBVTT\n\n';

				let timestampIndex = 0;
				data.content.timestamps.forEach((timestamp) => {
					let endTime: string;
					if (timestampIndex === data.content.timestamps.length - 1) {
						endTime = videoLength(data.video.lengthSeconds);
					} else {
						endTime = data.content.timestamps[timestampIndex + 1].timePretty;
					}

					chapterWebVTT += `${padTime(timestamp.timePretty)}.000 --> ${padTime(endTime)}.000\n${timestamp.title.replaceAll('-', '').trim()}\n\n`;

					timestampIndex += 1;
				});

				if (timestampIndex > 0) {
					player.addChaptersTrack(
						`data:text/vtt;base64,${btoa(chapterWebVTT)}`,
						get(playerDefaultLanguage)
					);
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

		if (data.video.fallbackPatch === 'youtubejs') {
			snackBarAlert = get(_)('player.youtubeJsFallBack');
			ui('#snackbar-alert');
		}

		restoreQualityPreference();
		restoreDefaultLanguage();

		if ($playerCCByDefault) {
			toggleSubtitles();
		}

		if ($playerDefaultPlaybackSpeed && playerElement) {
			playerElement.playbackRate = $playerDefaultPlaybackSpeed;
		}

		if ($playerStatisticsByDefault) {
			// Appears to be no native way in shaka to toggle statistics on and off
			const shakaStatisticsButton = document.querySelector('.shaka-statistics-button') as
				| HTMLButtonElement
				| undefined;
			shakaStatisticsButton?.click();
		}
	}

	async function reloadVideo() {
		showVideoRetry = false;
		data.video = await patchYoutubeJs(data.video.videoId);
		await loadVideo();
	}

	onMount(async () => {
		shaka.polyfill.installAll();
		if (!shaka.Player.isBrowserSupported()) {
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

		if ($playerState) {
			playerState.set({ ...$playerState, playerElement: playerElement });
		}

		// Due to how our player is rendered in layout for stateful pip
		// we calaculate player height to then allow children pages
		// to wrap around it.
		function updateVideoPlayerHeight() {
			const container = document.getElementById('shaka-container') as HTMLElement;

			if (container) {
				const height = container.getBoundingClientRect().height;
				document.documentElement.style.setProperty('--video-player-height', `${height + 10}px`);
			}
		}
		window.addEventListener('resize', updateVideoPlayerHeight);
		updateVideoPlayerHeight();

		// Change instantly to stop video from being loud for a second
		restoreVolumePreference();

		const playerContainer = document.getElementById('shaka-container') as HTMLElement;

		shakaUi = new shaka.ui.Overlay(player, playerContainer, playerElement);

		await player.attach(playerElement);

		shaka.ui.Controls.registerElement('end_time', {
			create: (parent: HTMLElement, controls: shaka.ui.Controls) => {
				return new EndTimeElement(parent, controls);
			}
		});

		shakaUi.configure({
			addBigPlayButton: Capacitor.getPlatform() === 'android',
			controlPanelElements: [
				'play_pause',
				Capacitor.getPlatform() === 'android' ? '' : 'volume',
				'spacer',
				'time_and_duration',
				data.video.liveNow || data.video.lengthSeconds < 240 ? '' : 'end_time',
				'captions',
				'overflow_menu',
				'fullscreen'
			],
			overflowMenuButtons: [
				'cast',
				'airplay',
				'quality',
				'playback_rate',
				'loop',
				'language',
				'statistics'
			],
			playbackRates: playbackRates,
			enableTooltips: false
		});

		updateSeekBarTheme();

		player?.addEventListener('error', (event) => {
			const error = (event as CustomEvent).detail as shaka.util.Error;
			console.error('Player error:', error);
		});

		player.getNetworkingEngine()?.registerResponseFilter((type, response, _) => {
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

		// Required to stop buttons from being still selected when fullscreening
		document?.addEventListener('fullscreenchange', async () => {
			const buttons = document.querySelectorAll('.shaka-controls-button-panel button');
			buttons.forEach((button) => {
				// Reset the button's focus and active states
				(button as HTMLElement).blur(); // Remove focus from the button
				button.removeAttribute('aria-pressed'); // Reset any ARIA attributes that might indicate selection
			});
		});

		playerElement?.addEventListener('volumechange', saveVolumePreference);

		await androidHandleRotate();

		if ('mediaSession' in navigator) {
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
			return false;
		});

		if (!$isAndroidTvStore) {
			Mousetrap.bind('right', () => {
				if (!playerElement) return;
				playerElement.currentTime = playerElement.currentTime + 10;
				return false;
			});

			Mousetrap.bind('left', () => {
				if (!playerElement) return;

				playerElement.currentTime = playerElement.currentTime - 10;
				return false;
			});
		}

		const volumeContainer = playerContainer.getElementsByClassName('shaka-volume-bar-container');
		volumeContainer[0]?.addEventListener('mousewheel', (event) => {
			event.preventDefault();
			const delta = Math.sign((event as any).deltaY);
			const newVolume = Math.max(
				0,
				Math.min(1, (playerElement as HTMLMediaElement).volume - delta * 0.05)
			);
			(playerElement as HTMLMediaElement).volume = newVolume;
		});

		Mousetrap.bind('c', () => {
			toggleSubtitles();
			return false;
		});

		Mousetrap.bind('f', () => {
			if (document.fullscreenElement) {
				document.exitFullscreen();
			} else {
				shakaUi.getControls()?.toggleFullScreen();
			}
			return false;
		});

		Mousetrap.bind('shift+left', () => {
			if (!playerElement) return;

			playerElement.playbackRate = playerElement.playbackRate - 0.25;
			return false;
		});

		Mousetrap.bind('shift+right', () => {
			if (!playerElement) return;

			playerElement.playbackRate = playerElement.playbackRate + 0.25;
			return false;
		});

		Mousetrap.bind(',', () => {
			if (!playerElement) return;

			const currentTrack = player.getVariantTracks().find((track) => track.active);
			const frameTime = 1 / (currentTrack?.frameRate || 30);
			playerElement.currentTime -= frameTime;
		});

		Mousetrap.bind('.', () => {
			if (!playerElement) return;

			const currentTrack = player.getVariantTracks().find((track) => track.active);
			const frameTime = 1 / (currentTrack?.frameRate || 30);
			playerElement.currentTime += frameTime;
		});

		playerElement?.addEventListener('pause', async () => {
			savePlayerPos();
		});

		playerElement?.addEventListener('ended', async () => {
			await goToNextVideo(data.video, data.playlistId);
		});

		try {
			await loadVideo();
		} catch (error: unknown) {
			if (
				!Capacitor.isNativePlatform() ||
				data.video.fallbackPatch === 'youtubejs' ||
				(error as shaka.extern.Error).code !== 1001
			)
				return;

			showVideoRetry = true;
			if ($playerYouTubeJsFallback) {
				await reloadVideo();
			}
		}
	});

	async function getLastPlayPos(): Promise<number> {
		if (loadTimeFromUrl($page) || !$playerSavePlaybackPositionStore) return 0;

		let toSetTime = 0;

		try {
			const playerPos = localStorage.getItem(`v_${data.video.videoId}`);
			if (playerPos && Number(playerPos) > toSetTime) {
				toSetTime = Number(playerPos);
			}
		} catch {}

		if ($synciousStore && $synciousInstanceStore && $authStore) {
			try {
				toSetTime = (await getVideoProgress(data.video.videoId))[0].time;
			} catch {}
		}

		return toSetTime;
	}

	function savePlayerPos() {
		if (data.video.liveNow) return;

		const synciousEnabled = $synciousStore && $synciousInstanceStore && $authStore;

		if ($playerSavePlaybackPositionStore && playerElement) {
			if (
				playerElement.currentTime < playerElement.duration - 10 &&
				playerElement.currentTime > 10
			) {
				try {
					localStorage.setItem(`v_${data.video.videoId}`, playerElement.currentTime.toString());
				} catch {}

				if (synciousEnabled) {
					saveVideoProgress(data.video.videoId, playerElement.currentTime);
				}
			} else {
				try {
					localStorage.removeItem(`v_${data.video.videoId}`);
				} catch {}

				if (synciousEnabled) {
					deleteVideoProgress(data.video.videoId);
				}
			}
		}
	}

	onDestroy(async () => {
		if (Capacitor.getPlatform() === 'android' && !$isAndroidTvStore) {
			if (originalOrigination) {
				await ScreenOrientation.lock({
					orientation: originalOrigination.type
				});
			}
		}

		try {
			savePlayerPos();
		} catch (error) {}

		Mousetrap.unbind(['left', 'right', 'space', 'c', 'f', 'shift+left', 'shift+right']);

		if (watchProgressTimeout) {
			clearTimeout(watchProgressTimeout);
		}

		if (sabrAdapter) {
			sabrAdapter.dispose();
		}

		if (player) {
			player.unload();
			player.destroy();
		}

		if (shakaUi) {
			shakaUi.destroy();
		}
	});
</script>

<div
	id="shaka-container"
	class="player-theme"
	class:contain-video={!$isAndroidTvStore}
	class:tv-contain-video={$isAndroidTvStore}
	data-shaka-player-container
	class:hide={showVideoRetry}
>
	<video
		controls={false}
		autoplay={$playerAutoPlayStore}
		id="player"
		poster={getBestThumbnail(data.video.videoThumbnails, 9999, 9999)}
	></video>
	{#if isEmbed && !isAndroidTvStore}
		<div class="chip blur embed" style="position: absolute;top: 10px;left: 10px;font-size: 18px;">
			{data.video.title}
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

{#if !isEmbed}
	<div class="snackbar" id="snackbar-alert">
		<span class="bold" style="text-transform: capitalize;">{snackBarAlert}</span>
	</div>
{/if}

<style>
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

	.hide {
		display: none;
	}
</style>
