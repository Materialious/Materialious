<script lang="ts">
	import Plyr, { type PlyrEvent, type SourceInfo, type Track } from 'plyr';
	// Needed to overwrite Beercss styles.
	import Dash from 'dashjs';
	import Hls from 'hls.js';
	import 'plyr/dist/plyr.css';
	import { SponsorBlock, type Category } from 'sponsorblock-api';
	import { onDestroy, onMount } from 'svelte';
	import { get } from 'svelte/store';

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

	let categoryBeingSkipped = '';

	let player: Plyr | undefined;
	let sponsorBlock: SponsorBlock | undefined;
	let hls: Hls | undefined;
	let dash: MediaPlayerClass | undefined;
	onMount(async () => {
		if (data.video.isUpcoming || !data.video.isListed) {
			return;
		}

		const playerPos = localStorage.getItem(data.video.videoId);

		const videoElement = document.getElementById('player') as HTMLMediaElement;

		player = new Plyr(videoElement, {
			controls: [
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
			]
		});

		const currentCategories = get(sponsorBlockCategories);

		if (currentCategories.length > 0) {
			sponsorBlock = new SponsorBlock('');

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

		player.on('loadeddata', (event: PlyrEvent) => {
			if (get(playerSavePlaybackPosition) && playerPos) {
				event.detail.plyr.currentTime = Number(playerPos);
			}
		});

		player.autoplay = get(playerAutoPlay);
		player.loop = get(playerAlwaysLoop);

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
			type: 'video',
			previewThumbnails: {
				src: data.video.videoThumbnails[0].url
			},
			poster: data.video.videoThumbnails[0].url,
			tracks: tracks,
			sources: []
		};

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
	<video id="player" playsinline controls> </video>
{/if}
