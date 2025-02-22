<script lang="ts">
	import { page } from '$app/stores';
	import { localProxy } from '$lib/android/http/androidRequests';
	import { getBestThumbnail } from '$lib/images';
	import { padTime, videoLength } from '$lib/time';
	import { Capacitor } from '@capacitor/core';
	import { ScreenOrientation, type ScreenOrientationResult } from '@capacitor/screen-orientation';
	import { StatusBar, Style } from '@capacitor/status-bar';
	import { NavigationBar } from '@hugotomazi/capacitor-navigation-bar';
	import { type Page } from '@sveltejs/kit';
	import GoogleVideo, { Protos } from 'googlevideo';
	import 'shaka-player/dist/controls.css';
	import shaka from 'shaka-player/dist/shaka-player.ui';
	import { SponsorBlock, type Category, type Segment } from 'sponsorblock-api';
	import { onDestroy, onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import { deleteVideoProgress, getVideoProgress, saveVideoProgress } from '../api';
	import type { VideoPlay } from '../api/model';
	import { type PhasedDescription } from '../misc';
	import {
		authStore,
		instanceStore,
		playerAndroidLockOrientation,
		playerAutoPlayStore,
		playerDefaultLanguage,
		playerProxyVideosStore,
		playerSavePlaybackPositionStore,
		poTokenCacheStore,
		sponsorBlockCategoriesStore,
		sponsorBlockDisplayToastStore,
		sponsorBlockStore,
		sponsorBlockUrlStore,
		synciousInstanceStore,
		synciousStore
	} from '../store';
	import { getDynamicTheme, setStatusBarColor } from '../theme';

	interface Props {
		data: { video: VideoPlay; content: PhasedDescription; playlistId: string | null };
		audioMode?: boolean;
		isSyncing?: boolean;
		isEmbed?: boolean;
		segments?: Segment[];
	}

	let { data, audioMode = false, isEmbed = false, segments = $bindable([]) }: Props = $props();

	let snackBarAlert = $state('');
	let playerPosSet = false;
	let originalOrigination: ScreenOrientationResult | undefined;
	let sponsorBlockElements: Element[] = [];
	let watchProgressTimeout: NodeJS.Timeout;

	let player: shaka.Player;
	let playerElement: HTMLMediaElement;

	function loadTimeFromUrl(page: Page): boolean {
		if (player) {
			const timeGivenUrl = page.url.searchParams.get('time');
			if (timeGivenUrl && !isNaN(parseFloat(timeGivenUrl))) {
				playerElement.currentTime = Number(timeGivenUrl);
				return true;
			}
		}

		return false;
	}

	page.subscribe((pageUpdate) => loadTimeFromUrl(pageUpdate));

	const proxyVideos = get(playerProxyVideosStore);

	onMount(async () => {
		shaka.polyfill.installAll();
		if (!shaka.Player.isBrowserSupported()) {
			return;
		}

		player = new shaka.Player();
		playerElement = document.getElementById('player') as HTMLMediaElement;

		await player.attach(playerElement);

		if (data.video.youtubeJsPatchInfo) {
			player.configure({
				streaming: {
					bufferingGoal:
						(data.video.youtubeJsPatchInfo.page[0].player_config?.media_common_config
							.dynamic_readahead_config.max_read_ahead_media_time_ms || 0) / 1000,
					rebufferingGoal:
						(data.video.youtubeJsPatchInfo.page[0].player_config?.media_common_config
							.dynamic_readahead_config.read_ahead_growth_rate_ms || 0) / 1000,
					bufferBehind: 300,
					autoLowLatencyMode: true
				},
				abr: {
					enabled: true,
					restrictions: {
						maxBandwidth: Number(
							data.video.youtubeJsPatchInfo.page[0].player_config?.stream_selection_config
								.max_bitrate
						)
					}
				}
			});

			const networkingEngine = player.getNetworkingEngine();

			if (!networkingEngine) return;

			networkingEngine.registerRequestFilter(async (type, request) => {
				const uri = request.uris[0];
				const url = new URL(uri);
				const headers = request.headers;

				if (type === shaka.net.NetworkingEngine.RequestType.SEGMENT) {
					if (url.pathname.includes('videoplayback')) {
						if (headers.Range) {
							url.searchParams.set('range', headers.Range.split('=')[1]);
							url.searchParams.set('ump', '1');
							url.searchParams.set('srfvp', '1');
							url.searchParams.set('pot', get(poTokenCacheStore).toString());
						}
					}

					request.method = 'POST';
					request.body = new Uint8Array([120, 0]);
				}

				if (Capacitor.getPlatform() === 'android' && data.video.fallbackPatch === 'youtubejs') {
					request.uris[0] = localProxy + url.toString();
				} else {
					request.uris[0] = url.toString();
				}
			});

			const RequestType = shaka.net.NetworkingEngine.RequestType;

			networkingEngine.registerResponseFilter(async (type, response) => {
				let mediaData = new Uint8Array(0);

				const handleRedirect = async (redirectData: Protos.SabrRedirect) => {
					const redirectRequest = shaka.net.NetworkingEngine.makeRequest(
						[redirectData.url!],
						player!.getConfiguration().streaming.retryParameters
					);
					const requestOperation = player!.getNetworkingEngine()!.request(type, redirectRequest);
					const redirectResponse = await requestOperation.promise;

					response.data = redirectResponse.data;
					response.headers = redirectResponse.headers;
					response.uri = redirectResponse.uri;
				};

				const handleMediaData = async (data: Uint8Array) => {
					const combinedLength = mediaData.length + data.length;
					const tempMediaData = new Uint8Array(combinedLength);

					tempMediaData.set(mediaData);
					tempMediaData.set(data, mediaData.length);

					mediaData = tempMediaData;
				};

				if (type == RequestType.SEGMENT) {
					const googUmp = new GoogleVideo.UMP(
						new GoogleVideo.ChunkedDataBuffer([new Uint8Array(response.data as ArrayBuffer)])
					);

					let redirect: Protos.SabrRedirect | undefined;

					googUmp.parse((part) => {
						try {
							const data = part.data.chunks[0];
							switch (part.type) {
								case 20: {
									const mediaHeader = Protos.MediaHeader.decode(data);
									console.info('[MediaHeader]:', mediaHeader);
									break;
								}
								case 21: {
									handleMediaData(part.data.split(1).remainingBuffer.chunks[0]);
									break;
								}
								case 43: {
									redirect = Protos.SabrRedirect.decode(data);
									console.info('[SABRRedirect]:', redirect);
									break;
								}
								case 58: {
									const streamProtectionStatus = Protos.StreamProtectionStatus.decode(data);
									switch (streamProtectionStatus.status) {
										case 1:
											console.info('[StreamProtectionStatus]: Ok');
											break;
										case 2:
											console.error('[StreamProtectionStatus]: Attestation pending');
											break;
										case 3:
											console.error('[StreamProtectionStatus]: Attestation required');
											break;
										default:
											break;
									}
									break;
								}
							}
						} catch (error) {
							console.error('An error occurred while processing the part:', error);
						}
					});

					if (redirect) return handleRedirect(redirect);

					if (mediaData.length) response.data = mediaData;
				}
			});
		}

		const shakaUi = new shaka.ui.Overlay(
			player,
			document.getElementById('shaka-container') as HTMLElement,
			playerElement
		);

		shakaUi.configure({
			controlPanelElements: [
				'play_pause',
				'spacer',
				'volume',
				'chapter',
				'time_and_duration',
				'overflow_menu'
			],
			overflowMenuButtons: ['cast', 'airplay', 'captions', 'quality', 'loop', 'language']
		});

		if (!data.video.hlsUrl) {
			let dashUrl = data.video.dashUrl;

			if (!data.video.fallbackPatch && (!Capacitor.isNativePlatform() || proxyVideos)) {
				dashUrl += '?local=true';
			}

			await player.load(dashUrl);

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
						URL.createObjectURL(new Blob([chapterWebVTT])),
						get(playerDefaultLanguage)
					);
				}
			}

			// Auto save watch progress every minute.
			watchProgressTimeout = setInterval(() => savePlayerPos(), 60000);

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

						player.addEventListener('time-update', () => {
							segments.forEach((segment) => {
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
					} catch {}
				}
			}

			await loadPlayerPos();

			const defaultLanguage = get(playerDefaultLanguage);
			if (defaultLanguage) {
				const audioLanguages = player.getAudioLanguages();
				if (audioLanguages.includes(defaultLanguage)) {
					player.selectAudioLanguage(defaultLanguage);
				}
			}

			if (Capacitor.getPlatform() === 'android' && data.video.adaptiveFormats.length > 0) {
				const videoFormats = data.video.adaptiveFormats.filter((format) =>
					format.type.startsWith('video/')
				);

				originalOrigination = await ScreenOrientation.orientation();

				player.addEventListener('fullscreen-change', async () => {
					const isFullScreen = document.fullscreenElement;

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

					if (!get(playerAndroidLockOrientation)) return;

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
		} else {
			await player.load(data.video.hlsUrl + '?local=true');
		}

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

		if (toSetTime > 0) playerElement.currentTime = toSetTime;
	}

	function savePlayerPos() {
		if (data.video.hlsUrl) return;

		if (get(playerSavePlaybackPositionStore) && player && playerElement.currentTime) {
			if (
				playerElement.currentTime < playerElement.duration - 10 &&
				playerElement.currentTime > 10
			) {
				try {
					localStorage.setItem(`v_${data.video.videoId}`, playerElement.currentTime.toString());
				} catch {}

				if (get(synciousStore) && get(synciousInstanceStore) && get(authStore)) {
					saveVideoProgress(data.video.videoId, playerElement.currentTime);
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
		await playerElement.pause();
		player.destroy();
		playerElement.remove();
		playerPosSet = false;
	});
</script>

{#if audioMode}
	<div style="margin-top: 40vh;"></div>
{/if}

<div id="shaka-container" data-shaka-player-container>
	<video
		controls={false}
		autoplay={$playerAutoPlayStore}
		id="player"
		width="100%"
		poster={getBestThumbnail(data.video.videoThumbnails, 1251, 781)}
	></video>
</div>

{#if !isEmbed}
	<div class="snackbar" id="snackbar-alert">
		<span class="bold" style="text-transform: capitalize;">{snackBarAlert}</span>
	</div>
{/if}
