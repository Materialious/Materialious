<script lang="ts">
	import { page } from '$app/stores';
	import { getBestThumbnail, ImageCache } from '$lib/images';
	import { padTime, videoLength } from '$lib/numbers';
	import { type PhasedDescription, type Timestamp } from '$lib/timestamps';
	import { SystemBars, SystemBarsStyle, SystemBarType } from '@capacitor/core';
	import { Capacitor } from '@capacitor/core';
	import { ScreenOrientation, type ScreenOrientationResult } from '@capacitor/screen-orientation';
	import { error, type Page } from '@sveltejs/kit';
	import ISO6391 from 'iso-639-1';
	import Mousetrap from 'mousetrap';
	import { CapacitorMusicControls } from 'capacitor-music-controls-plugin';
	import shaka from 'shaka-player/dist/shaka-player.ui';
	import { SponsorBlock, type Category, type Segment } from 'sponsorblock-api';
	import { onDestroy, onMount, tick } from 'svelte';
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import { Slider } from 'melt/builders';
	import { deleteVideoProgress, getVideoProgress, saveVideoProgress } from '../api';
	import type { VideoPlay } from '../api/model';
	import {
		authStore,
		instanceStore,
		isAndroidTvStore,
		playerAlwaysLoopStore,
		playerAndroidLockOrientation,
		playerAndroidPauseOnNetworkChange,
		playerAutoPlayStore,
		playerCCByDefault,
		playerDefaultLanguage,
		playerDefaultPlaybackSpeed,
		playerDefaultQualityStore,
		playerProxyVideosStore,
		playerSavePlaybackPositionStore,
		playerState,
		playertheatreModeIsActive,
		playerYouTubeJsFallback,
		sponsorBlockCategoriesStore,
		sponsorBlockDisplayToastStore,
		sponsorBlockStore,
		sponsorBlockTimelineStore,
		sponsorBlockUrlStore,
		synciousInstanceStore,
		synciousStore
	} from '../store';
	import { setStatusBarColor } from '../theme';
	import { getVideoTYjs } from '$lib/api/youtubejs';
	import {
		goToNextVideo,
		goToPreviousVideo,
		playbackRates,
		playerDoubleTapSeek
	} from '$lib/player';
	import { dashManifestDomainInclusion } from '$lib/android/youtube/dash';
	import { injectSabr } from '$lib/sabr';
	import type { SabrStreamingAdapter } from 'googlevideo/sabr-streaming-adapter';
	import { SvelteSet } from 'svelte/reactivity';
	import { Network, type ConnectionStatus } from '@capacitor/network';
	import { fade } from 'svelte/transition';
	import { addToast } from './Toast.svelte';
	import { isMobile, truncate } from '$lib/misc';
	import {
		drawTimelineThumbnail,
		storyboardThumbnails,
		type TimelineThumbnail
	} from '$lib/timelineThumbnails';

	interface Props {
		data: { video: VideoPlay; content: PhasedDescription; playlistId: string | null };
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
	const sponsorSegments = {
		sponsor: $_('layout.sponsors.sponsor'),
		selfpromo: $_('layout.sponsors.unpaidSelfPromotion'),
		interaction: $_('layout.sponsors.interactionReminder'),
		intro: $_('layout.sponsors.intermissionIntroAnimation'),
		outro: $_('layout.sponsors.credits'),
		preview: $_('layout.sponsors.preViewRecapHook'),
		filler: $_('layout.sponsors.tangentJokes'),
		music_offtopic: $_('layout.sponsors.musicOffTopic')
	};

	let originalOrigination: ScreenOrientationResult | undefined;
	let watchProgressInterval: ReturnType<typeof setInterval>;
	let showVideoRetry = $state(false);

	let androidInitialNetworkStatus: ConnectionStatus | undefined;

	let player: shaka.Player;
	let sabrAdapter: SabrStreamingAdapter | null;

	let playerContainer: HTMLElement;
	let playerBufferBar: HTMLElement | undefined = $state();
	let playerCurrentPlaybackState = $state(false);
	let playerMaxKnownTime = $state(data.video.lengthSeconds);
	let playerIsBuffering = $state(true);
	let playerVolume = $state(0);
	let playerSettings: 'quality' | 'speed' | 'language' | 'root' = $state('root');
	let playerTextTracks: shaka.extern.TextTrack[] | undefined = $state(undefined);
	let playerCurrentVideoTrack: shaka.extern.VideoTrack | undefined = $state(undefined);
	let playerCurrentAudioTrack: shaka.extern.AudioTrack | undefined = $state(undefined);
	let playerLoop = $state($playerAlwaysLoopStore);
	let playerTimelineTimeHover: number = $state(0);
	let playerVideoEndTimePretty: string = $state('');
	let playerBufferedTo: number = $state(0);
	let playerCloestTimestamp: Timestamp | undefined = $state();
	let playerCloestSponsor: Segment | undefined = $state();
	let playerSliderElement: HTMLElement | undefined = $state();
	let playerSliderDebounce: ReturnType<typeof setTimeout>;
	let playerVolumeElement: HTMLElement | undefined = $state();
	let playerIsFullscreen: boolean = $state(false);
	let playerTimelineTooltip: HTMLDivElement | undefined = $state();
	let playerTimelineThumbnails: TimelineThumbnail[] = $state([]);
	let playerTimelineThumbnailsCache = new ImageCache();
	let playerTimelineThumbnailCanvas: HTMLCanvasElement | undefined = $state();
	let playerInitalInteract = true;

	const playerTimelineSlider = new Slider({
		min: 0,
		step: 0.1,
		value: () => currentTime,
		onValueChange: (timeToSet) => {
			userManualSeeking = true;
			currentTime = timeToSet;

			showPlayerUI();
			setPlayerTimelineChapters(currentTime);

			if (playerSliderDebounce) clearTimeout(playerSliderDebounce);

			playerSliderDebounce = setTimeout(() => {
				if (playerElement) {
					playerElement.currentTime = timeToSet;
					userManualSeeking = false;
				}
			}, 300);
		},
		max: () => playerMaxKnownTime
	});

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

	let clickCount = $state(0);
	let clickCounterTimeout: ReturnType<typeof setTimeout>;

	let seekDirection: 'forwards' | 'backwards' | undefined = $state();
	const STORAGE_KEY_VOLUME = 'shaka-preferred-volume';

	playertheatreModeIsActive.subscribe(async () => {
		await tick();
		updateVideoPlayerHeight();
	});

	const markerGapSize = 0.1;
	const minVisiblePercent = 0.05;
	function timelineMarkerWidth(startTime: number, endTime: number): string {
		const ratio = (endTime - startTime) / playerMaxKnownTime;
		if (ratio <= 0) return `0%`;

		let percent = ratio * 100;
		if (percent - markerGapSize >= minVisiblePercent) {
			percent = percent - markerGapSize;
		} else {
			percent = minVisiblePercent;
		}

		return `${percent}%`;
	}

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

	function filterUniqueAudioTracks(tracks: shaka.extern.AudioTrack[]): shaka.extern.AudioTrack[] {
		const uniqueTracks: shaka.extern.AudioTrack[] = [];
		const seen = new SvelteSet<string>();

		for (const track of tracks) {
			const identifier = `${track.language}-${track.label || 'No Label'}`;
			if (!seen.has(identifier)) {
				seen.add(identifier);
				uniqueTracks.push(track);
			}
		}

		return uniqueTracks;
	}

	function saveVolumePreference() {
		if (!playerElement) return;
		playerVolume = playerElement.volume;
		localStorage.setItem(STORAGE_KEY_VOLUME, playerElement.volume.toString());
	}

	function restoreVolumePreference() {
		const savedVolume = localStorage.getItem(STORAGE_KEY_VOLUME);
		if (savedVolume && playerElement) {
			playerElement.volume = parseFloat(savedVolume);
			playerVolume = playerElement.volume;
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
				orientation: (originalOrigination as ScreenOrientationResult).type
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

		originalOrigination = await ScreenOrientation.orientation();

		document.addEventListener('fullscreenchange', onAndroidFullscreenChange);
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

		if ($sponsorBlockCategoriesStore && $sponsorBlockUrlStore && $sponsorBlockUrlStore !== '') {
			const sponsorBlock = new SponsorBlock('', { baseURL: $sponsorBlockUrlStore });

			try {
				segments = await sponsorBlock.getSegments(
					data.video.videoId,
					Object.keys($sponsorBlockCategoriesStore) as Category[]
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

	function setActiveVideoTrack() {
		const videoTracks = player.getVideoTracks();
		playerCurrentVideoTrack = videoTracks.find((track) => track.active);
	}

	function setActiveAudioTrack() {
		const audioTracks = player.getAudioTracks();
		playerCurrentAudioTrack = audioTracks.find((track) => track.active);
	}

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

		if (data.video.fallbackPatch === 'youtubejs') {
			addToast({ data: { text: $_('player.youtubeJsFallBack') } });
		}

		setupSponsorSkip();

		player.addEventListener('loaded', () => {
			restoreQualityPreference();
			restoreDefaultLanguage();
			setActiveVideoTrack();
			setActiveAudioTrack();
			updateVideoPlayerHeight();

			if ($playerCCByDefault) {
				toggleSubtitles();
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

			if (data.video.storyboards && data.video.storyboards.length > 1) {
				// Use best possible thumbnails
				playerTimelineThumbnails = await storyboardThumbnails(
					data.video.storyboards[data.video.storyboards.length - 1],
					playerTimelineThumbnailsCache,
					playerMaxKnownTime
				);
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

				data.content.timestamps.forEach((timestamp, timestampIndex) => {
					let endTime: string;
					if (timestampIndex === data.content.timestamps.length - 1) {
						endTime = videoLength(data.video.lengthSeconds);
					} else {
						endTime = data.content.timestamps[timestampIndex + 1].timePretty;
					}

					chapterWebVTT += `${padTime(timestamp.timePretty)}.000 --> ${padTime(endTime)}.000\n${timestamp.title.replaceAll('-', '').trim()}\n\n`;
				});

				try {
					player.addChaptersTrack(
						`data:text/vtt;base64,${btoa(chapterWebVTT)}`,
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
		data.video = await getVideoTYjs(data.video.videoId);
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

		// Enable AirPlay if supported
		if (hasWebkitShowPlaybackTargetPicker(playerElement)) {
			playerElement.setAttribute('x-webkit-airplay', 'allow');
		}

		playerElement.loop = playerLoop;

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

		await androidHandleRotate();

		if (Capacitor.getPlatform() === 'android') {
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
			toggleSubtitles();
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

		playerVolumeElement?.addEventListener('mousewheel', (event) => {
			event.preventDefault();
			const delta = Math.sign((event as any).deltaY);
			const newVolume = Math.max(
				0,
				Math.min(1, (playerElement as HTMLMediaElement).volume - delta * 0.05)
			);
			(playerElement as HTMLMediaElement).volume = newVolume;
			playerVolume = newVolume;
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

			const buffered = playerElement.buffered;

			if (buffered.length > 0 && playerBufferBar) {
				playerBufferedTo = buffered.end(0);

				const bufferedPercent = (playerBufferedTo / playerMaxKnownTime) * 100;
				const progressPercent = (currentTime / playerMaxKnownTime) * 100;

				const bufferAhead = Math.max(0, bufferedPercent - progressPercent);

				const effectiveWidth = Math.min(bufferAhead, 100 - progressPercent);

				playerBufferBar.style.left = progressPercent + '%';
				playerBufferBar.style.width = effectiveWidth + '%';
			}
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

		// Update video player height again on video loaded.
		updateVideoPlayerHeight();

		playerTextTracks = player.getTextTracks();
	});

	function hasWebkitShowPlaybackTargetPicker(
		el: HTMLMediaElement
	): el is HTMLMediaElement & { webkitShowPlaybackTargetPicker: () => void } {
		return typeof (el as any).webkitShowPlaybackTargetPicker === 'function';
	}

	function handleAirPlayClick() {
		if (playerElement && hasWebkitShowPlaybackTargetPicker(playerElement)) {
			playerElement.webkitShowPlaybackTargetPicker();
		}
	}

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

		if ($synciousStore && $synciousInstanceStore && $authStore) {
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

		const synciousEnabled = $synciousStore && $synciousInstanceStore && $authStore;

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

	function setPlayerTimelineChapters(currentTime: number) {
		if (data.content.timestamps.length > 0) {
			playerCloestTimestamp = data.content.timestamps.find((chapter, chapterIndex) => {
				let endTime: number;
				if (chapterIndex === data.content.timestamps.length - 1) {
					endTime = data.video.lengthSeconds;
				} else {
					endTime = data.content.timestamps[chapterIndex + 1].time;
				}
				return currentTime >= chapter.time && currentTime < endTime;
			});
		}

		if (segments.length > 0) {
			playerCloestSponsor = segments.find((segment) => {
				return currentTime >= segment.startTime && currentTime < segment.endTime;
			});
		}
	}

	let requestAnimationTooltip: number | undefined;
	let latestMouseX: number | undefined;

	function timelineMouseMove(event: MouseEvent) {
		latestMouseX = event.clientX;

		if (!requestAnimationTooltip) {
			requestAnimationTooltip = requestAnimationFrame(updateTooltip);
		}
	}

	async function updateTooltip() {
		if (!playerSliderElement || latestMouseX === undefined) {
			requestAnimationTooltip = undefined;
			return;
		}

		const rect = playerSliderElement.getBoundingClientRect();
		const percent = Math.min(Math.max((latestMouseX - rect.left) / rect.width, 0), 1);

		playerTimelineTimeHover = percent * (data.video.lengthSeconds ?? 0);
		setPlayerTimelineChapters(playerTimelineTimeHover);

		if (playerTimelineThumbnailCanvas) {
			const canvasContext = playerTimelineThumbnailCanvas.getContext('2d');

			if (canvasContext) {
				await drawTimelineThumbnail(
					canvasContext,
					playerTimelineThumbnailsCache,
					playerTimelineThumbnails,
					playerTimelineTimeHover
				);
			}
		}

		if (playerTimelineTooltip) {
			const tooltipWidth = playerTimelineTooltip.offsetWidth;
			const tooltipHeight = playerTimelineTooltip.offsetHeight;
			const sliderWidth = playerSliderElement.clientWidth;

			let left = percent * sliderWidth;
			left = Math.min(Math.max(left, tooltipWidth / 2), sliderWidth - tooltipWidth / 2);
			playerTimelineTooltip.style.transform = `translateX(${left - tooltipWidth / 2}px)`;

			playerTimelineTooltip.style.top = `${-tooltipHeight - 5}px`;
		}

		requestAnimationTooltip = undefined;
	}

	function onVideoClick(
		event: MouseEvent & {
			currentTarget: EventTarget & HTMLDivElement;
		}
	) {
		event.preventDefault();
		seekDirection = undefined;

		if (
			!event.target ||
			!(event.target instanceof HTMLElement) ||
			event.target.id !== 'player-tap-controls-area' ||
			!playerElement
		) {
			return;
		}

		if (isMobile() && playerInitalInteract) {
			showPlayerUI();
			playerInitalInteract = false;
			clickCount = 0;
			return;
		}

		clickCount++;

		const container = event.currentTarget;
		const rect = container.getBoundingClientRect();
		const clickX = event.clientX - rect.left;
		const width = rect.width;

		if (clickCounterTimeout) clearTimeout(clickCounterTimeout);

		clickCounterTimeout = setTimeout(() => {
			if (clickCount == 1) {
				toggleVideoPlaybackStatus();
			}
			clickCount = 0;
		}, 200);

		if (clickCount < 2) return;

		if (clickX < width / 3) {
			seekDirection = 'backwards';
			playerElement.currentTime = Math.max(0, playerElement.currentTime - playerDoubleTapSeek);
		} else if (clickX < (2 * width) / 3) {
			toggleFullscreen();
		} else {
			seekDirection = 'forwards';
			playerElement.currentTime = Math.min(
				playerMaxKnownTime,
				playerElement.currentTime + playerDoubleTapSeek
			);
		}
	}

	onDestroy(async () => {
		if (Capacitor.getPlatform() === 'android') {
			if (!$isAndroidTvStore) {
				document.removeEventListener('fullscreenchange', onAndroidFullscreenChange);

				if (originalOrigination) {
					await ScreenOrientation.lock({
						orientation: originalOrigination.type
					});
				}
			}

			await Network.removeAllListeners();

			await setStatusBarColor();

			await CapacitorMusicControls.destroy();
		}

		try {
			savePlayerPos();
		} catch {
			// Continue regardless of error
		}

		playerTimelineThumbnailsCache.clear();

		window.removeEventListener('resize', updateVideoPlayerHeight);

		Mousetrap.unbind(['left', 'right', 'space', 'c', 'f', 'shift+left', 'shift+right', 'enter']);

		if (watchProgressInterval) clearInterval(watchProgressInterval);
		if (sabrAdapter) sabrAdapter.dispose();
		if (clickCounterTimeout) clearTimeout(clickCounterTimeout);
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
	onclick={onVideoClick}
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
			<p class="chip inverse-primary s">
				{#if data.video.liveNow}
					{$_('thumbnail.live')}
				{:else}
					{videoLength(currentTime)} / {videoLength(playerMaxKnownTime)}
				{/if}
			</p>
			<p class="chip inverse-primary">
				{playerVideoEndTimePretty}
			</p>
		</div>
	{/if}
	<div id="player-center">
		<div class="grid">
			<div class="s4 m4 l4" id="player-tap-controls-area">
				{#if clickCount > 1 && seekDirection === 'backwards'}
					<div
						class="seek-double-click"
						class:buffer-left={seekDirection === 'backwards'}
						id="player-tap-controls-area"
					>
						<h4 id="player-tap-controls-area">-{(clickCount - 1) * playerDoubleTapSeek}</h4>
					</div>
				{/if}
			</div>
			<div class="s4 m4 l4">
				<div class="player-status" id="player-tap-controls-area">
					{#if playerIsBuffering}
						<progress class="circle large indeterminate" value="50" max="100"></progress>
					{/if}
				</div>
			</div>
			<div class="s4 m4 l4" id="player-tap-controls-area">
				{#if clickCount > 1 && seekDirection === 'forwards'}
					<div
						class="seek-double-click"
						class:buffer-right={seekDirection === 'forwards'}
						id="player-tap-controls-area"
					>
						<h4 id="player-tap-controls-area">+{(clickCount - 1) * playerDoubleTapSeek}</h4>
					</div>
				{/if}
			</div>
		</div>
	</div>
	{#if showControls}
		<div id="player-controls" transition:fade>
			<div
				class="player-slider full-width"
				class:disable-tv={$isAndroidTvStore}
				{...playerTimelineSlider.root}
				onmousemove={timelineMouseMove}
				bind:this={playerSliderElement}
			>
				{#snippet timelineTooltip()}
					{#if playerCloestSponsor}
						{sponsorSegments[playerCloestSponsor.category]}
						<br />
					{:else if playerCloestTimestamp}
						{truncate(playerCloestTimestamp.title, 22)}
						<br />
					{/if}
				{/snippet}
				<div class="track">
					{#if !userManualSeeking}
						<div bind:this={playerTimelineTooltip} class="timeline tooltip">
							{#if playerTimelineThumbnails.length > 0}
								<canvas
									bind:this={playerTimelineThumbnailCanvas}
									width={playerTimelineThumbnails[0].width}
									height={playerTimelineThumbnails[0].height}
								>
									></canvas
								>
							{/if}
							{@render timelineTooltip()}
							{videoLength(playerTimelineTimeHover)}
						</div>
					{/if}
					<div class="range"></div>
					<div {...playerTimelineSlider.thumb}>
						<div class="tooltip thumb-tooltip">
							{@render timelineTooltip()}
							{videoLength(currentTime)}
						</div>
					</div>
				</div>
				<div bind:this={playerBufferBar} class="buffered-bar" class:hide={userManualSeeking}></div>
				{#each data.content.timestamps as chapter, index (chapter)}
					<div
						class="chapter-marker"
						style:left="{(chapter.time / playerMaxKnownTime) * 100}%"
						style:width={timelineMarkerWidth(
							chapter.time,
							data.content.timestamps[index + 1]?.time || playerMaxKnownTime // Next chapter time or end of video
						)}
					></div>
				{/each}
				{#if !$sponsorBlockTimelineStore}
					{#each segments as segment (segment)}
						<div
							class="chapter-marker segment-marker"
							style:left="{(segment.startTime / playerMaxKnownTime) * 100}%"
							style:width={timelineMarkerWidth(segment.startTime, segment.endTime)}
						></div>
					{/each}
				{/if}
			</div>

			<nav>
				{#if !$isAndroidTvStore}
					<nav class="no-wrap">
						<button class="inverse-primary" onclick={toggleVideoPlaybackStatus}>
							<i>
								{#if playerCurrentPlaybackState}
									pause
								{:else}
									play_arrow
								{/if}
							</i>
						</button>
						{#if !isMobile()}
							<div
								bind:this={playerVolumeElement}
								class="player-slider volume m l"
								{...playerVolumeSlider.root}
							>
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
						{#if playerTextTracks && playerTextTracks.length > 0 && !data.video.liveNow}
							<button class="inverse-primary">
								<i>closed_caption</i>
								<menu class="no-wrap mobile" id="cc-menu" data-ui="#cc-menu">
									<li
										role="presentation"
										data-ui="#cc-menu"
										onclick={() => player.setTextTrackVisibility(false)}
									>
										{$_('player.controls.off')}
									</li>
									{#each playerTextTracks as track (track)}
										<li
											role="presentation"
											data-ui="#cc-menu"
											onclick={() => {
												player.selectTextTrack(track);
												player.setTextTrackVisibility(true);
											}}
										>
											{track.label}
										</li>
									{/each}
								</menu>
							</button>
						{/if}
						<button class="inverse-primary">
							<i>settings</i>
							<menu class="no-wrap mobile" id="settings-menu">
								{#if playerSettings !== 'root'}
									<li role="presentation" onclick={() => (playerSettings = 'root')}>
										<i>arrow_back</i>
										{$_('player.controls.back')}
									</li>
								{/if}
								{#if playerSettings === 'root'}
									<li role="presentation" onclick={() => (playerSettings = 'quality')}>
										<nav class="no-wrap" style="width: 100%;">
											<i>high_quality</i>
											{$_('player.controls.quality')}

											<div class="max"></div>

											<span class="chip">
												{#if playerCurrentVideoTrack}
													{playerCurrentVideoTrack.height}p
												{:else}
													{$_('player.controls.auto')}
												{/if}
											</span>
										</nav>
									</li>
									<li role="presentation" onclick={() => (playerSettings = 'speed')}>
										<nav class="no-wrap" style="width: 100%;">
											<i>speed</i>
											{$_('player.controls.playbackSpeed')}

											<div class="max"></div>

											<span class="chip">
												{playerElement?.playbackRate}x
											</span>
										</nav>
									</li>
									{#if playerCurrentAudioTrack && playerCurrentAudioTrack.label !== null}
										<li role="presentation" onclick={() => (playerSettings = 'language')}>
											<nav class="no-wrap" style="width: 100%;">
												<i>language</i>
												{$_('player.controls.language')}

												<div class="max"></div>

												<span class="chip">
													{#if playerCurrentAudioTrack}
														{playerCurrentAudioTrack.language !== 'und'
															? ISO6391.getName(playerCurrentAudioTrack.language)
															: playerCurrentAudioTrack.label}
													{/if}
												</span>
											</nav>
										</li>
									{/if}
									<li
										role="presentation"
										onclick={() => {
											if (playerElement) playerElement.loop = !playerLoop;
											playerLoop = !playerLoop;
										}}
									>
										<nav class="no-wrap" style="width: 100%;">
											<i>all_inclusive</i>
											{$_('player.controls.loop')}

											<div class="max"></div>

											<span class="chip">
												{playerLoop ? $_('player.controls.on') : $_('player.controls.off')}
											</span>
										</nav>
									</li>
								{:else if playerSettings === 'quality'}
									<li
										role="presentation"
										onclick={() => {
											playerSettings = 'root';
											player.configure({ abr: true });
											playerCurrentVideoTrack = undefined;
										}}
									>
										{$_('player.controls.auto')}
									</li>
									{#each player.getVideoTracks().sort((a, b) => {
										const heightA = a.height || 0;
										const heightB = b.height || 0;
										const widthA = a.width || 0;
										const widthB = b.width || 0;
										return heightB - heightA || widthB - widthA;
									}) as track (track)}
										<li
											role="presentation"
											onclick={() => {
												playerSettings = 'root';
												player.selectVideoTrack(track, true);
												setActiveVideoTrack();
											}}
										>
											{track.height}p
										</li>
									{/each}
								{:else if playerSettings === 'speed'}
									{#each playbackRates as playbackRate (playbackRate)}
										<li
											role="presentation"
											onclick={() => {
												playerSettings = 'root';
												if (playerElement) playerElement.playbackRate = playbackRate;
											}}
										>
											{playbackRate}
										</li>
									{/each}
								{:else if playerSettings === 'language'}
									{#each filterUniqueAudioTracks(player.getAudioTracks()) as track (track)}
										<li
											role="presentation"
											onclick={() => {
												playerSettings = 'root';
												player.selectAudioTrack(track);
												setActiveAudioTrack();
											}}
										>
											{#if track.language !== 'und'}
												{ISO6391.getName(track.language)} -
											{/if}
											{track.label}
										</li>
									{/each}
								{/if}
							</menu>
						</button>
						{#if playerElement && hasWebkitShowPlaybackTargetPicker(playerElement)}
							<button class="inverse-primary" onclick={handleAirPlayClick} title="AirPlay">
								<i>airplay</i>
							</button>
						{/if}
						{#if document.pictureInPictureEnabled}
							<button
								class="inverse-primary"
								onclick={() => {
									(playerElement as HTMLVideoElement).requestPictureInPicture();
								}}
							>
								<i>pip</i>
							</button>
						{/if}
						<button class="inverse-primary" onclick={toggleFullscreen}>
							<i>
								{#if playerIsFullscreen}
									fullscreen_exit
								{:else}
									fullscreen
								{/if}
							</i>
						</button>
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
	:root {
		--player-timeline-height: 1.1rem;
	}

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

	#player-controls span {
		clip-path: none;
	}

	#player-tap-controls-area {
		touch-action: manipulation;
	}

	#player-center {
		position: absolute;
		width: 100%;
		height: 100%;
	}

	.player-status {
		display: flex;
		justify-content: center;
		align-items: center;
		height: var(--video-player-height);
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

	.player-slider {
		height: var(--player-timeline-height);
		margin: 0 auto;
		border-radius: 0.25rem;
	}

	.player-slider.full-width {
		width: 100%;
	}

	.player-slider.volume {
		width: 200px;
	}

	.player-slider .track {
		background: var(--secondary-container);
		height: 100%;
		position: relative;
		border-radius: 0.25rem;
	}

	.player-slider .range {
		position: absolute;
		background: var(--inverse-primary);
		inset: 0;
		right: var(--percentage-inv);
		border-radius: 0.25rem;
		opacity: 0.5;
	}

	.player-slider [data-melt-slider-thumb] {
		position: absolute;
		border-radius: 1rem;
		background: var(--inverse-primary);
		left: var(--percentage);
		top: 50%;
		width: 5px;
		height: 35px;
		z-index: 3;
		cursor: grab;
		transform: translate(-50%, -50%);
	}

	.thumb-tooltip {
		left: var(--percentage);
	}

	.seek-double-click {
		background-color: var(--secondary-container);
		height: var(--video-player-height);
		color: var(--secondary);
		width: 100%;
		opacity: 0.8;
		padding: 1em;
		display: flex;
		justify-content: center;
		align-items: center;
		user-select: none;
	}

	.seek-double-click.buffer-right {
		border-top-left-radius: 0.25rem;
		border-bottom-left-radius: 0.25rem;
	}

	.seek-double-click.buffer-left {
		border-top-right-radius: 0.25rem;
		border-bottom-right-radius: 0.25rem;
	}

	.buffered-bar {
		position: absolute;
		height: var(--player-timeline-height);
		background: var(--secondary);
		top: 50%;
		left: 0;
		transform: translateY(-50%);
		z-index: 1;
		pointer-events: none;
		border-top-right-radius: 0.25rem;
		border-bottom-right-radius: 0.25rem;
		opacity: 0.5;
	}

	.chapter-marker {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		left: 0;
		height: var(--player-timeline-height);
		background-color: var(--secondary);
		border-radius: 0.25rem;
		z-index: 2;
		pointer-events: none;
		opacity: 0.5;
	}

	.segment-marker {
		background-color: var(--tertiary);
	}

	.disable-tv {
		pointer-events: none;
		cursor: not-allowed;
	}

	menu.mobile {
		transform: scale(1) translateY(-40%) translateX(0);
		width: 300px;
		height: 200px;
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
		background-color: var(--inverse-primary);
		color: var(--primary);
		border: none;
	}

	.hide-cursor {
		cursor: none;
	}

	.timeline.tooltip {
		position: absolute;
		left: 0;
		transform: translateX(0%);
		transition: none;
		pointer-events: none;
		will-change: transform;
		padding: 0;
		border-radius: 0.25rem;
		display: block;
	}

	.timeline.tooltip canvas {
		display: block;
		margin-bottom: 0.1rem;
		height: 100px;
	}
</style>
