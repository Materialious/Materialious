<script lang="ts">
	import { page } from '$app/stores';
	import '$lib/css/shaka-player-theme.css';
	import { getBestThumbnail } from '$lib/images';
	import { padTime, videoLength } from '$lib/numbers';
	import { type PhasedDescription } from '$lib/timestamps';
	import { Capacitor } from '@capacitor/core';
	import { ScreenOrientation, type ScreenOrientationResult } from '@capacitor/screen-orientation';
	import { StatusBar, Style } from '@capacitor/status-bar';
	import { NavigationBar } from '@hugotomazi/capacitor-navigation-bar';
	import { error, type Page } from '@sveltejs/kit';
	import { HttpFetchPlugin } from '$lib/sabr/shakaHttpPlugin';
	import ui from 'beercss';
	import ISO6391 from 'iso-639-1';
	import Mousetrap from 'mousetrap';
	import 'shaka-player/dist/controls.css';
	import shaka from 'shaka-player/dist/shaka-player.ui';
	import { SponsorBlock, type Category, type Segment } from 'sponsorblock-api';
	import { onDestroy, onMount, tick } from 'svelte';
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import { deleteVideoProgress, getVideoProgress, saveVideoProgress } from '../api';
	import type { PlaylistPageVideo, VideoPlay } from '../api/model';
	import {
		authStore,
		darkModeStore,
		instanceStore,
		isAndroidTvStore,
		playerAndroidLockOrientation,
		playerAutoplayNextByDefaultStore,
		playerAutoPlayStore,
		playerCCByDefault,
		playerDefaultLanguage,
		playerDefaultPlaybackSpeed,
		playerDefaultQualityStore,
		playerProxyVideosStore,
		playerSavePlaybackPositionStore,
		playerStatisticsByDefault,
		playerYouTubeJsFallback,
		playlistSettingsStore,
		sponsorBlockCategoriesStore,
		sponsorBlockDisplayToastStore,
		sponsorBlockStore,
		sponsorBlockUrlStore,
		synciousInstanceStore,
		synciousStore,
		syncPartyConnectionsStore,
		themeColorStore
	} from '../store';
	import { getDynamicTheme, setStatusBarColor } from '../theme';
	import { injectSABR } from '$lib/sabr';
	import { patchYoutubeJs } from '$lib/patches/youtubejs';
	import { playbackRates } from '$lib/const';
	import { EndTimeElement } from '$lib/shaka-elements/endTime';
	import { loadEntirePlaylist } from '$lib/playlist';
	import { goto } from '$app/navigation';
	import { unsafeRandomItem } from '$lib/misc';
	import type { PlayerEvents } from '$lib/player';

	interface Props {
		data: { video: VideoPlay; content: PhasedDescription; playlistId: string | null };
		isSyncing?: boolean;
		isEmbed?: boolean;
		segments?: Segment[];
		playerElement?: HTMLMediaElement | undefined;
	}

	let {
		data,
		isEmbed = false,
		segments = $bindable([]),
		playerElement = $bindable(undefined)
	}: Props = $props();

	let snackBarAlert = $state('');
	let originalOrigination: ScreenOrientationResult | undefined;
	let watchProgressTimeout: NodeJS.Timeout;
	let playerElementResizeObserver: ResizeObserver | undefined;
	let showVideoRetry = $state(false);

	let player: shaka.Player;
	let shakaUi: shaka.ui.Overlay;

	const STORAGE_KEY_VOLUME = 'shaka-preferred-volume';

	async function updateSeekBarTheme() {
		if (!shakaUi) return;
		await tick();
		shakaUi.configure({
			seekBarColors: {
				played: (await getDynamicTheme())['--primary']
			}
		});

		setChapterMarkers();

		const overflowMenuButton = document.querySelector('.shaka-overflow-menu-button');
		if (overflowMenuButton) {
			overflowMenuButton.innerHTML = 'settings';
		}

		const backToOverflowButton = document.querySelector('.shaka-back-to-overflow-button');
		if (backToOverflowButton) {
			backToOverflowButton.innerHTML = 'arrow_back_ios_new';
		}
	}

	themeColorStore.subscribe(updateSeekBarTheme);
	darkModeStore.subscribe(updateSeekBarTheme);

	function setChapterMarkers() {
		const shakaControls = shakaUi.getControls();
		if (data.content.timestamps && shakaControls) {
			const seekBar = shakaControls
				.getControlsContainer()
				.querySelector('.shaka-seek-bar-container');

			data.content.timestamps.forEach((chapter, index) => {
				const nextChapter = data.content.timestamps[index + 1];

				const marker = document.createElement('div');
				marker.classList.add('chapter-marker');

				const startPercent = (chapter.time / data.video.lengthSeconds) * 100;
				let widthPercent: number;

				if (nextChapter) {
					widthPercent = ((nextChapter.time - chapter.time) / data.video.lengthSeconds) * 100;
				} else {
					widthPercent = 100 - startPercent;
				}

				marker.style.left = `${startPercent}%`;
				marker.style.width = `${widthPercent}%`;

				const tooltip = document.createElement('div');
				tooltip.classList.add('tooltip');
				tooltip.textContent = chapter.title;

				marker.appendChild(tooltip);

				if (seekBar) seekBar.appendChild(marker);
			});
		}
	}

	function restoreDefaultLanguage() {
		if ($playerDefaultLanguage) {
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
			player.selectVariantTrack(selectedTrack, true);
			HttpFetchPlugin.cacheManager.clearCache();
			player.configure({ abr: { enabled: false } });
		} else {
			player.configure({ abr: { enabled: true } });
		}
	}

	async function androidHandleRotate() {
		if (
			Capacitor.getPlatform() === 'android' &&
			data.video.adaptiveFormats.length > 0 &&
			!$isAndroidTvStore
		) {
			const videoFormats = data.video.adaptiveFormats.filter((format) =>
				format.type.startsWith('video/')
			);

			originalOrigination = await ScreenOrientation.orientation();

			document.addEventListener('fullscreenchange', async () => {
				const isFullScreen = !!document.fullscreenElement;

				if (isFullScreen) {
					// Ensure bar color is black while in fullscreen
					await StatusBar.setBackgroundColor({ color: '#000000' });
					await NavigationBar.setColor({
						color: '#000000'
					});
					await StatusBar.setStyle({ style: Style.Dark });
				} else {
					await setStatusBarColor();
				}

				if (!$playerAndroidLockOrientation) return;

				if (isFullScreen && videoFormats[0].resolution) {
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
		}
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
			const defaultLanguage = get(playerDefaultLanguage);
			const langCode = ISO6391.getCode(defaultLanguage);

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
		// Will inject requirements for SABR if SABR is required.
		playerElementResizeObserver = injectSABR(player, playerElement as HTMLMediaElement, data.video);

		if (!data.video.liveNow) {
			if (data.video.captions) {
				data.video.captions.forEach(async (caption) => {
					player.addTextTrackAsync(
						caption.url.startsWith('http') ? caption.url : `${get(instanceStore)}${caption.url}`,
						caption.language_code,
						'captions',
						undefined,
						undefined,
						caption.label
					);
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
					player.addChaptersTrack(
						`data:text/vtt;base64,${btoa(chapterWebVTT)}`,
						get(playerDefaultLanguage)
					);
				}
			}

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
			if (import.meta.env.VITE_DEFAULT_COMPANION_INSTANCE && Capacitor.getPlatform() === 'web') {
				dashUrl = `${import.meta.env.VITE_DEFAULT_COMPANION_INSTANCE}/api/manifest/dash/id/${data.video.videoId}`;
			} else {
				if (!data.video.dashUrl) {
					error(500, 'No dash manifest found');
					return;
				}
				dashUrl = data.video.dashUrl;
			}

			if (!data.video.fallbackPatch && (!Capacitor.isNativePlatform() || $playerProxyVideosStore)) {
				dashUrl += '?local=true';
			}

			await player.load(dashUrl, await getLastPlayPos());
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

		HttpFetchPlugin.cacheManager.clearCache();

		player = new shaka.Player();

		// YouTube's defaults
		player.configure({
			abr: {
				enabled: true,
				restrictions: {
					maxWidth: 1920,
					maxHeight: 1080
				}
			},
			streaming: {
				bufferingGoal: 120,
				rebufferingGoal: 0.01,
				bufferBehind: 300,
				retryParameters: {
					maxAttempts: 30,
					baseDelay: 1500,
					backoffFactor: 2.5,
					fuzzFactor: 0.7,
					timeout: 120000
				},
				stallThreshold: 2,
				stallSkip: 0.5
			}
		});
		playerElement = document.getElementById('player') as HTMLMediaElement;

		// Change instantly to stop video from being loud for a second
		restoreVolumePreference();

		shakaUi = new shaka.ui.Overlay(
			player,
			document.getElementById('shaka-container') as HTMLElement,
			playerElement
		);

		shaka.ui.Controls.registerElement('end_time', {
			create: (parent: HTMLElement, controls: shaka.ui.Controls) => {
				return new EndTimeElement(parent, controls);
			}
		});

		shakaUi.configure({
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

		player.addEventListener('error', (event) => {
			const error = (event as CustomEvent).detail as shaka.util.Error;
			console.error('Player error:', error);
		});

		// Required to stop buttons from being still selected when fullscreening
		document.addEventListener('fullscreenchange', async () => {
			const buttons = document.querySelectorAll('.shaka-controls-button-panel button');
			buttons.forEach((button) => {
				// Reset the button's focus and active states
				(button as HTMLElement).blur(); // Remove focus from the button
				button.removeAttribute('aria-pressed'); // Reset any ARIA attributes that might indicate selection
			});
		});

		await player.attach(playerElement);

		playerElement.addEventListener('volumechange', saveVolumePreference);

		await androidHandleRotate();

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

		playerElement.addEventListener('pause', async () => {
			savePlayerPos();
		});

		playerElement.addEventListener('ended', async () => {
			if (!data.playlistId) {
				if ($playerAutoplayNextByDefaultStore) {
					goto(
						`/${$isAndroidTvStore ? 'tv' : 'watch'}/${data.video.recommendedVideos[0].videoId}`,
						{ replaceState: $isAndroidTvStore }
					);
				}

				return;
			}

			const playlist = await loadEntirePlaylist(data.playlistId);
			const playlistVideoIds = playlist.videos.map((value) => {
				return value.videoId;
			});

			let goToVideo: PlaylistPageVideo | undefined;

			const shufflePlaylist = $playlistSettingsStore[data.playlistId]?.shuffle ?? false;
			const loopPlaylist = $playlistSettingsStore[data.playlistId]?.loop ?? false;

			if (shufflePlaylist) {
				goToVideo = unsafeRandomItem(playlist.videos);
			} else {
				const currentVideoIndex = playlistVideoIds.indexOf(data.video.videoId);
				const newIndex = currentVideoIndex + 1;
				if (currentVideoIndex !== -1 && newIndex < playlistVideoIds.length) {
					goToVideo = playlist.videos[newIndex];
				} else if (loopPlaylist) {
					// Loop playlist on end
					goToVideo = playlist.videos[0];
				}
			}

			if (typeof goToVideo !== 'undefined') {
				if ($syncPartyConnectionsStore) {
					$syncPartyConnectionsStore.forEach((conn) => {
						if (typeof goToVideo === 'undefined') return;

						conn.send({
							events: [
								{ type: 'change-video', videoId: goToVideo.videoId },
								{ type: 'playlist', playlistId: data.playlistId }
							]
						} as PlayerEvents);
					});
				}

				goto(
					`/${$isAndroidTvStore ? 'tv' : 'watch'}/${goToVideo.videoId}?playlist=${data.playlistId}`,
					{ replaceState: $isAndroidTvStore }
				);
			}
		});

		try {
			await loadVideo();
		} catch (error: unknown) {
			if (!Capacitor.isNativePlatform() || data.video.fallbackPatch === 'youtubejs') return;
			showVideoRetry = true;

			if ((error as shaka.extern.Error).code === 1001 && $playerYouTubeJsFallback) {
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
				await StatusBar.setOverlaysWebView({ overlay: false });
				await StatusBar.show();
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

		HttpFetchPlugin.cacheManager.clearCache();

		if (playerElementResizeObserver) {
			playerElementResizeObserver.disconnect();
		}

		if (playerElement) {
			playerElement.src = '';
			playerElement.load();
		}

		if (player) {
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
	<article class="fallback">
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

	.fallback {
		height: 30vh;
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}
</style>
