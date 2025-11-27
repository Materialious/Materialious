<script lang="ts">
	import { resolve } from '$app/paths';
	import { instanceStore } from '$lib/store';
	import { Share } from '@capacitor/share';
	import ui from 'beercss';
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

	async function shareUrl(url: string, param: string = 't') {
		if (includeTimestamp) url += `?${param}=${Math.floor(currentTime ?? 0)}`;

		if ((await Share.canShare()) && Capacitor.getPlatform() !== 'electron') {
			await Share.share({ url: url, dialogTitle: video.title });
		} else {
			await Clipboard.write({ string: url });
			ui('#share-success');
		}
	}
</script>

<menu class="no-wrap mobile" data-ui="#share-menu" id="share-menu">
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
		data-ui="#share-menu"
		class="row"
		role="presentation"
		onclick={async () => {
			if (Capacitor.isNativePlatform()) {
				shareUrl(`${get(instanceStore)}/watch/${video.videoId}`);
			} else {
				shareUrl(
					`${location.origin}${resolve('/watch/[videoId]', { videoId: video.videoId })}`,
					'time'
				);
			}
		}}
	>
		<div class="min">{$_('player.share.materialiousLink')}</div>
	</li>
	<li
		data-ui="#share-menu"
		class="row"
		role="presentation"
		onclick={async () => {
			shareUrl(`https://redirect.invidious.io/watch?v=${video.videoId}`);
		}}
	>
		<div class="min">{$_('player.share.invidiousRedirect')}</div>
	</li>
	<li
		data-ui="#share-menu"
		class="row"
		role="presentation"
		onclick={async () => {
			shareUrl(`https://www.youtube.com/watch?v=${video.videoId}`);
		}}
	>
		<div class="min">{$_('player.share.youtubeLink')}</div>
	</li>
</menu>

<div class="snackbar" id="share-success">{$_('player.share.copiedSuccess')}</div>
