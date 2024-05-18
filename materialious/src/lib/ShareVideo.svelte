<script lang="ts">
	import { Capacitor } from '@capacitor/core';
	import { _ } from 'svelte-i18n';
	import type { Notification, PlaylistPageVideo, Video, VideoBase } from './Api/model';

	export let video: VideoBase | Video | Notification | PlaylistPageVideo;
</script>

{#if !Capacitor.isNativePlatform()}
	<a
		class="row"
		href="#copy"
		on:click={async () =>
			await navigator.clipboard.writeText(`${location.origin}/watch/${video.videoId}`)}
	>
		<div class="min">{$_('player.share.materialiousLink')}</div></a
	>
{/if}
<a
	href="#copy"
	class="row"
	on:click={async () =>
		await navigator.clipboard.writeText(`https://redirect.invidious.io/watch?v=${video.videoId}`)}
>
	<div class="min">{$_('player.share.invidiousRedirect')}</div></a
><a
	class="row"
	href="#copy"
	on:click={async () =>
		await navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${video.videoId}`)}
>
	<div class="min">{$_('player.share.youtubeLink')}</div></a
>
