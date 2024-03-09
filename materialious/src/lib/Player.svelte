<script lang="ts">
	import Plyr, { type PlyrEvent } from 'plyr';
	import 'plyr/dist/plyr.css';
	import { SponsorBlock, type Category } from 'sponsorblock-api';
	import { onDestroy, onMount } from 'svelte';
	import { get } from 'svelte/store';

	import {
		invidiousInstance,
		playerAlwaysLoop,
		playerAutoPlay,
		playerSavePlaybackPosition,
		sponsorBlockCategories
	} from '../store';
	import type { VideoPlay } from './Api/model';

	export let data: { video: VideoPlay };

	let categoryBeingSkipped = 'sponsorblock-alert';

	let player: Plyr | undefined;
	let sponsorBlock: SponsorBlock | undefined;
	onMount(async () => {
		const playerPos = localStorage.getItem(data.video.videoId);

		player = new Plyr('#player');

		const currentCategories = get(sponsorBlockCategories);

		if (currentCategories.length > 0) {
			sponsorBlock = new SponsorBlock('');

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
		}

		player.on('loadeddata', (event: PlyrEvent) => {
			if (get(playerSavePlaybackPosition) && playerPos) {
				event.detail.plyr.currentTime = Number(playerPos);
			}
		});

		player.autoplay = get(playerAutoPlay);
		player.loop = get(playerAlwaysLoop);

		player.source = {
			type: 'video',
			previewThumbnails: {
				src: data.video.videoThumbnails[0].url
			},
			poster: data.video.videoThumbnails[0].url,
			tracks: data.video.captions.map((caption) => {
				return {
					kind: 'captions',
					label: caption.label,
					srcLang: caption.languageCode,
					src: `${get(invidiousInstance)}${caption.url}`
				};
			}),
			sources: data.video.formatStreams.map((format) => {
				return { src: format.url, size: Number(format.size.split('x')[1]), type: format.type };
			})
		};
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
		document.getElementsByClassName('plyr')[0]?.remove();
	});
</script>

<div class="snackbar" id="sponsorblock-alert">
	<span
		>Skipping <span class="bold" style="text-transform: capitalize;">{categoryBeingSkipped}</span
		></span
	>
</div>

<video width="100%" id="player" playsinline controls> </video>
