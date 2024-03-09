<script lang="ts">
	import Plyr, { type PlyrEvent } from 'plyr';
	import 'plyr/dist/plyr.css';
	import { onDestroy, onMount } from 'svelte';
	import { get } from 'svelte/store';

	import {
		invidiousInstance,
		playerAlwaysLoop,
		playerAutoPlay,
		playerSavePlaybackPosition
	} from '../store';
	import type { VideoPlay } from './Api/model';
	export let data: { video: VideoPlay };

	let player: Plyr | undefined;
	onMount(async () => {
		const playerPos = localStorage.getItem(data.video.videoId);

		player = new Plyr('#player');

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
			if (player.currentTime < player.duration - 10) {
				localStorage.setItem(data.video.videoId, player.currentTime.toString());
			} else {
				localStorage.removeItem(data.video.videoId);
			}
		}

		player = undefined;
		document.getElementsByClassName('plyr')[0]?.remove();
	});
</script>

<video width="100%" id="player" playsinline controls> </video>
