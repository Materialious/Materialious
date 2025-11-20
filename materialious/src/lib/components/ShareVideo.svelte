<script lang="ts">
	import { resolve } from '$app/paths';
	import { instanceStore } from '$lib/store';
	import { Clipboard } from '@capacitor/clipboard';
	import { Capacitor } from '@capacitor/core';
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import type { Notification, PlaylistPageVideo, Video, VideoBase } from '../api/model';

	interface Props {
		video: VideoBase | Video | Notification | PlaylistPageVideo;
		currentTime?: number;
	}

	let { video, currentTime = $bindable() }: Props = $props();
	let includeTimestamp: boolean = $state(false);
</script>

{#if currentTime !== undefined}
	<li class="row">
		<label class="switch">
			<input type="checkbox" bind:checked={includeTimestamp} />
			<span></span>
		</label>
		<div class="min">{$_('player.share.includeTimestamp')}</div>
	</li>
	<div class="divider"></div>
{/if}
<li
	class="row"
	role="presentation"
	onclick={async () => {
		let url = '';
		if (Capacitor.isNativePlatform()) {
			url = `${get(instanceStore)}/watch/${video.videoId}`;
		} else {
			url = `${location.origin}${resolve('/watch/[videoId]', { videoId: video.videoId })}`;
		}
		if (includeTimestamp && currentTime !== undefined) {
			url += `?time=${Math.floor(currentTime)}`;
		}
		await Clipboard.write({ string: url });
		(document.activeElement as HTMLElement)?.blur();
	}}
>
	<div class="min">{$_('player.share.materialiousLink')}</div>
</li>
<li
	class="row"
	role="presentation"
	onclick={async () => {
		let url = `https://redirect.invidious.io/watch?v=${video.videoId}`;
		if (includeTimestamp && currentTime !== undefined) {
			url += `&t=${Math.floor(currentTime)}`;
		}
		await Clipboard.write({ string: url });
		(document.activeElement as HTMLElement)?.blur();
	}}
>
	<div class="min">{$_('player.share.invidiousRedirect')}</div>
</li>
<li
	class="row"
	role="presentation"
	onclick={async () => {
		let url = `https://www.youtube.com/watch?v=${video.videoId}`;
		if (includeTimestamp && currentTime !== undefined) {
			url += `&t=${Math.floor(currentTime)}`;
		}
		await Clipboard.write({ string: url });
		(document.activeElement as HTMLElement)?.blur();
	}}
>
	<div class="min">{$_('player.share.youtubeLink')}</div>
</li>
