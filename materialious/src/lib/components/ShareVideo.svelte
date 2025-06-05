<script lang="ts">
	import { instanceStore } from '$lib/store';
	import { Clipboard } from '@capacitor/clipboard';
	import { Capacitor } from '@capacitor/core';
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import type { Notification, PlaylistPageVideo, Video, VideoBase } from '../api/model';

	interface Props {
		video: VideoBase | Video | Notification | PlaylistPageVideo;
	}

	let { video }: Props = $props();
</script>

<button
	class="row"
	onclick={async () => {
		if (Capacitor.isNativePlatform()) {
			await Clipboard.write({ string: `${get(instanceStore)}/watch/${video.videoId}` });
		} else {
			await Clipboard.write({ string: `${location.origin}/watch/${video.videoId}` });
		}
	}}
>
	<div class="min">{$_('player.share.materialiousLink')}</div></button
>
<button
	class="row"
	onclick={async () =>
		await Clipboard.write({ string: `https://redirect.invidious.io/watch?v=${video.videoId}` })}
>
	<div class="min">{$_('player.share.invidiousRedirect')}</div></button
><button
	class="row"
	onclick={async () =>
		await Clipboard.write({ string: `https://www.youtube.com/watch?v=${video.videoId}` })}
>
	<div class="min">{$_('player.share.youtubeLink')}</div></button
>
