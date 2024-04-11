<script lang="ts">
	import { getPlaylist } from '$lib/Api/index';
	import type { PlaylistPageVideo } from '$lib/Api/model.js';
	import VideoList from '$lib/VideoList.svelte';
	import { cleanNumber, unsafeRandomItem } from '$lib/misc.js';
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { activePage, playlistSettings } from '../../../store';

	export let data;

	activePage.set(null);

	let videos: PlaylistPageVideo[] | undefined;
	if (data.playlist.videos.length > 0) {
		videos = data.playlist.videos.sort((a: PlaylistPageVideo, b: PlaylistPageVideo) => {
			return a.index < b.index ? -1 : 1;
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
				on:click={() =>
					playlistSettings.set({ [data.playlist.playlistId]: { shuffle: true, loop: false } })}
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
</article>

{#if videos}
	<VideoList {videos} playlistId={data.playlist.playlistId} />
{/if}
