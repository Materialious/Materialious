<script lang="ts">
	import { Clipboard } from '@capacitor/clipboard';
	import { Capacitor } from '@capacitor/core';
	import { _ } from 'svelte-i18n';
	import type { Notification, PlaylistPageVideo, Video, VideoBase } from '../api/model';

	interface Props {
		video: VideoBase | Video | Notification | PlaylistPageVideo;
	}

	let { video }: Props = $props();
</script>

{#if !Capacitor.isNativePlatform()}
	<a
		class="row"
		href="#copy"
		onclick={async () =>
			await Clipboard.write({ string: `${location.origin}/watch/${video.videoId}` })}
	>
		<div class="min">{$_('player.share.materialiousLink')}</div></a
	>
{/if}
<a
	href="#copy"
	class="row"
	onclick={async () =>
		await Clipboard.write({ string: `https://redirect.invidious.io/watch?v=${video.videoId}` })}
>
	<div class="min">{$_('player.share.invidiousRedirect')}</div></a
><a
	class="row"
	href="#copy"
	onclick={async () =>
		await Clipboard.write({ string: `https://www.youtube.com/watch?v=${video.videoId}` })}
>
	<div class="min">{$_('player.share.youtubeLink')}</div></a
>
