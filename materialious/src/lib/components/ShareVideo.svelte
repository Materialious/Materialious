<script lang="ts">
	import { resolve } from '$app/paths';
	import { instanceStore } from '$lib/store';
	import ui from 'beercss';
	import { Capacitor } from '@capacitor/core';
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import type { Notification, PlaylistPageVideo, Video, VideoBase } from '../api/model';
	import { shareURL } from '$lib/misc';

	interface Props {
		video: VideoBase | Video | Notification | PlaylistPageVideo;
		currentTime?: number;
	}

	let { video, currentTime = $bindable() }: Props = $props();
	let includeTimestamp: boolean = $state(false);

	async function shareVideo(url: string, param: string = 't') {
		if (includeTimestamp) url += `?${param}=${Math.floor(currentTime ?? 0)}`;

		await shareURL(url);

		ui('#share-success');
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
				shareVideo(`${get(instanceStore)}/watch/${video.videoId}`);
			} else {
				shareVideo(
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
			shareVideo(`https://redirect.invidious.io/watch?v=${video.videoId}`);
		}}
	>
		<div class="min">{$_('player.share.invidiousRedirect')}</div>
	</li>
	<li
		data-ui="#share-menu"
		class="row"
		role="presentation"
		onclick={async () => {
			shareVideo(`https://www.youtube.com/watch?v=${video.videoId}`);
		}}
	>
		<div class="min">{$_('player.share.youtubeLink')}</div>
	</li>
</menu>

<div class="snackbar" id="share-success">{$_('player.share.copiedSuccess')}</div>
