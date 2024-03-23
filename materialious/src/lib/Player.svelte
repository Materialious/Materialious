<script lang="ts">
	import Plyr, { type PlyrEvent, type SourceInfo, type Track } from 'plyr';
	// Needed to overwrite Beercss styles.
	import Dash from 'dashjs';
	import Hls from 'hls.js';
	import 'plyr/dist/plyr.css';
	import { SponsorBlock, type Category } from 'sponsorblock-api';
	import { onDestroy, onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import { sponsorBlock as sponsorBlockStore, sponsorBlockUrl } from '../store';

	import type { MediaPlayerClass } from 'dashjs';
	import {
		invidiousInstance,
		playerAlwaysLoop,
		playerAutoPlay,
		playerDash,
		playerProxyVideos,
		playerSavePlaybackPosition,
		sponsorBlockCategories
	} from '../store';
	import type { VideoPlay } from './Api/model';
	import { getDynamicTheme } from './theme';

	export let data: { video: VideoPlay };
	export let currentTime: number = 0;
	export let audioMode = false;

	let previousMode = structuredClone(audioMode);

	export function seekTo(time: number) {
		if (typeof player !== 'undefined') {
			player.currentTime = time;
		}
	}

	let player: Plyr | undefined = undefined;

	let categoryBeingSkipped = '';

	let sponsorBlock: SponsorBlock | undefined;
	let hls: Hls | undefined;
	let dash: MediaPlayerClass | undefined;

	$: {
		if (previousMode !== audioMode) {
			tick().then(async () => {
				document.getElementsByClassName('plyr')[0]?.remove();
				await createPlayer();
				previousMode = structuredClone(audioMode);
			});
		}
	}

	async function createPlayer() {
		if (data.video.isUpcoming || !data.video.isListed) {
			return;
		}

		const playerPos = localStorage.getItem(data.video.videoId);

		const tracks: Track[] = [];

		for (const caption of data.video.captions) {
			// Have to preload captions, due to cors issue with how plyr
			// grabs captions
			if (!caption) {
				continue;
			}

			const captions = await fetch(`${get(invidiousInstance)}${caption.url}`);
			if (captions.status === 200) {
				tracks.push({
					kind: 'captions',
					label: caption.label,
					srcLang: caption.languageCode,
					src: URL.createObjectURL(await captions.blob())
				});
			}
		}

		const sourceInfo: SourceInfo = {
			type: !audioMode ? 'video' : 'audio',
			previewThumbnails: {
				src: data.video.videoThumbnails[0].url
			},
			poster: data.video.videoThumbnails[0].url,
			tracks: tracks,
			sources: []
		};

		const videoElement = document.getElementById('player') as HTMLMediaElement;

		const controls = [
			'play-large',
			'play',
			'progress',
			'current-time',
			'duration',
			'volume',
			'captions',
			'settings',
			'download',
			'fullscreen'
		];

		const qualitySettings = {
			default: 720,
			options: [4320, 2880, 2160, 1440, 1080, 720, 576, 480, 360, 240]
		};

		if (audioMode) {
			qualitySettings.options = [];

			data.video.adaptiveFormats.forEach((source) => {
				if (typeof source.audioQuality !== 'undefined') {
					const bitrate = Number(source.bitrate);
					qualitySettings.options.push(bitrate);
					sourceInfo.sources.push({
						src: source.url,
						type: source.type,
						size: bitrate
					});
				}
			});

			qualitySettings.default = qualitySettings.options[0];
		}

		player = new Plyr(videoElement, {
			controls: controls,
			quality: qualitySettings
		});

		if (get(sponsorBlockStore)) {
			const currentCategories = get(sponsorBlockCategories);

			if (currentCategories.length > 0) {
				sponsorBlock = new SponsorBlock('', { baseURL: get(sponsorBlockUrl) });

				try {
					const segments = await sponsorBlock.getSegments(
						data.video.videoId,
						get(sponsorBlockCategories) as Category[]
					);

					player.on('timeupdate', (event: PlyrEvent) => {
						segments.forEach((segment) => {
							if (
								event.detail.plyr.currentTime >= segment.startTime &&
								event.detail.plyr.currentTime <= segment.endTime
							) {
								categoryBeingSkipped = segment.category;
								event.detail.plyr.currentTime = segment.endTime + 1;
								ui('#sponsorblock-alert');
							}
						});
					});
				} catch {}
			}
		}

		player.on('loadeddata', (event: PlyrEvent) => {
			if (get(playerSavePlaybackPosition) && playerPos) {
				event.detail.plyr.currentTime = Number(playerPos);
			}
		});

		player.on('timeupdate', (event: PlyrEvent) => {
			currentTime = event.detail.plyr.currentTime;
		});

		player.autoplay = get(playerAutoPlay);
		player.loop = get(playerAlwaysLoop);

		if (!audioMode) {
			if (!data.video.hlsUrl) {
				if (get(playerDash)) {
					dash = Dash.MediaPlayer().create();
					dash.initialize(videoElement, data.video.dashUrl + '?local=true', get(playerAutoPlay));
				} else {
					const proxyVideos = get(playerProxyVideos);

					let src;
					sourceInfo.sources = data.video.formatStreams.map((format) => {
						if (proxyVideos) {
							const rawSrc = new URL(format.url);
							rawSrc.host = import.meta.env.VITE_DEFAULT_INVIDIOUS_INSTANCE.replace(
								'http://',
								''
							).replace('https://', '');

							src = rawSrc.toString();
						} else {
							src = format.url;
						}
						return {
							src: src,
							size: Number(format.size.split('x')[1]),
							type: format.type
						};
					});
				}
			} else {
				hls = new Hls();
				hls.loadSource(data.video.hlsUrl + '?local=true');
				hls.attachMedia(videoElement);
			}
		}

		player.source = sourceInfo;

		const currentTheme = await getDynamicTheme();

		document.documentElement.style.setProperty('--plyr-color-main', currentTheme['--primary']);
		document.documentElement.style.setProperty(
			'--plyr-menu-background',
			currentTheme['--secondary-container']
		);
		document.documentElement.style.setProperty(
			'--plyr-menu-color',
			currentTheme['--secondary-text']
		);
	}

	onMount(async () => {
		await createPlayer();
	});

	onDestroy(async () => {
		if (get(playerSavePlaybackPosition) && player?.currentTime) {
			if (player.currentTime < player.duration - 10 && player.currentTime > 10) {
				localStorage.setItem(data.video.videoId, player.currentTime.toString());
			} else {
				localStorage.removeItem(data.video.videoId);
			}
		}

		player = undefined;
		sponsorBlock = undefined;
		hls = undefined;
		dash = undefined;
		document.getElementsByClassName('plyr')[0]?.remove();
	});
</script>

<div class="snackbar" id="sponsorblock-alert">
	<span
		>Skipping <span class="bold" style="text-transform: capitalize;">{categoryBeingSkipped}</span
		></span
	>
</div>

{#if data.video.isUpcoming}
	<h3>Video hasn't premiered yet</h3>
{:else if !data.video.isListed}
	<h3>Video isn't listed</h3>
{:else}
	{#if audioMode}
		<div style="margin-top: 50vh;"></div>
	{/if}

	{#key audioMode}
		<video id="player" playsinline controls> </video>
	{/key}
{/if}
