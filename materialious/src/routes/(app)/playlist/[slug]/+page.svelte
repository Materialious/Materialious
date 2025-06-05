<script lang="ts">
	import { getPlaylist } from '$lib/api/index';
	import type { PlaylistPageVideo } from '$lib/api/model';
	import VideoList from '$lib/components/VideoList.svelte';
	import { unsafeRandomItem } from '$lib/misc';
	import { cleanNumber } from '$lib/numbers';
	import { playlistSettingsStore } from '$lib/store';
	import { Clipboard } from '@capacitor/clipboard';
	import { Capacitor } from '@capacitor/core';
	import { onMount } from 'svelte';
	import { _ } from '$lib/i18n';

	let { data } = $props();

	let videos: PlaylistPageVideo[] | undefined = $state();
	if (data.playlist.videos.length > 0) {
		videos = data.playlist.videos.sort((a: PlaylistPageVideo, b: PlaylistPageVideo) => {
			return a.index < b.index ? -1 : 1;
		});
		videos = videos.filter((playlistVideo) => {
			return playlistVideo.lengthSeconds > 0;
		});

		onMount(async () => {
			for (let page = 1; page++; ) {
				const newVideos = (await getPlaylist(data.playlist.playlistId, page)).videos;
				if (newVideos.length === 0) {
					break;
				}
				videos = [...(videos as PlaylistPageVideo[]), ...newVideos].sort(
					(a: PlaylistPageVideo, b: PlaylistPageVideo) => {
						return a.index < b.index ? -1 : 1;
					}
				);
				videos = videos.filter((playlistVideo) => {
					return playlistVideo.lengthSeconds > 0;
				});
			}
		});
	}
</script>

<div class="space"></div>

<article>
	{#if videos}
		<nav>
			<a
				href={`/watch/${videos[0].videoId}?playlist=${data.playlist.playlistId}`}
				class="button circle extra no-margin"
			>
				<i>play_arrow</i>
				<div class="tooltip bottom">
					{$_('playlist.playVideos')}
				</div>
			</a>

			<a
				href={`/watch/${unsafeRandomItem(videos).videoId}?playlist=${data.playlist.playlistId}`}
				onclick={() =>
					playlistSettingsStore.set({ [data.playlist.playlistId]: { shuffle: true, loop: false } })}
				class="button circle extra no-margin border"
			>
				<i>shuffle</i>
				<div class="tooltip bottom">
					{$_('playlist.shuffleVideos')}
				</div>
			</a>
		</nav>
	{/if}
	<h3>{data.playlist.title}</h3>
	<p>
		{cleanNumber(data.playlist.viewCount)}
		{$_('views')} • {data.playlist.videoCount}
		{$_('videos')}
	</p>
	<div class="divider" style="margin-bottom: 1em;"></div>

	<article style="max-height: 200px;" class="scroll no-padding no-elevate no-round">
		<p style="white-space: pre-line;word-wrap: break-word;">{data.playlist.description}</p>
	</article>

	<div class="space"></div>

	<button class="border no-margin">
		<i>share</i>
		<span>{$_('player.share.title')}</span>
		<menu class="no-wrap mobile">
			{#if !Capacitor.isNativePlatform()}
				<button
					class="row"
					onclick={async () => {
						await Clipboard.write({ string: location.href });
					}}>{$_('player.share.materialiousLink')}</button
				>
			{/if}
			<!--Silly hack so svelte doesnt error-->
			{#if true}
				<button
					class="row"
					onclick={async () => {
						await Clipboard.write({
							string: `https://www.youtube.com/playlist?list=${data.playlist.playlistId}`
						});
					}}
				>
					{$_('player.share.youtubeLink')}
				</button>
			{/if}
		</menu>
	</button>
</article>

{#if videos}
	<VideoList {videos} playlistAuthor={data.playlist.author} playlistId={data.playlist.playlistId} />
{/if}
