<script lang="ts">
	import Plyr from 'plyr';
	import 'plyr/dist/plyr.css';
	import { onDestroy, onMount, tick } from 'svelte';
	import { get } from 'svelte/store';

	import { invidiousInstance } from '../store';
	import type { VideoPlay } from './Api/model';
	export let data: { video: VideoPlay };

	let player: Plyr | undefined;
	onMount(() => {
		player = new Plyr('#player');
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
		player = undefined;
		await tick();
		console.log(document);
		document.getElementsByClassName('plyr')[0]?.remove();
	});
</script>

<video width="100%" id="player" playsinline controls> </video>
