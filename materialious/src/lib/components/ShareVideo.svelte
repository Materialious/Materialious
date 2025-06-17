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

<li
	class="row"
	role="presentation"
	onclick={async () => {
		if (Capacitor.isNativePlatform()) {
			await Clipboard.write({ string: `${get(instanceStore)}/watch/${video.videoId}` });
		} else {
			await Clipboard.write({ string: `${location.origin}/watch/${video.videoId}` });
		}
		(document.activeElement as HTMLElement)?.blur();
	}}
>
	<div class="min">{$_('player.share.materialiousLink')}</div>
</li>
<li
	class="row"
	role="presentation"
	onclick={async () => {
		await Clipboard.write({ string: `https://redirect.invidious.io/watch?v=${video.videoId}` });
		(document.activeElement as HTMLElement)?.blur();
	}}
>
	<div class="min">{$_('player.share.invidiousRedirect')}</div>
</li>
<li
	class="row"
	role="presentation"
	onclick={async () => {
		await Clipboard.write({ string: `https://www.youtube.com/watch?v=${video.videoId}` });
		(document.activeElement as HTMLElement)?.blur();
	}}
>
	<div class="min">{$_('player.share.youtubeLink')}</div>
</li>
