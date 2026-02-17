<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PlaylistPage, PlaylistPageVideo, VideoPlay } from '$lib/api/model';
	import { _ } from '$lib/i18n';
	import { cleanNumber } from '$lib/numbers';
	import { goToNextVideo, goToPreviousVideo } from '$lib/player';
	import { playlistSettingsStore } from '$lib/store';
	import VideoThumbnail from '../thumbnail/VideoThumbnail.svelte';

	let {
		playlist,
		video
	}: { playlist: { videos: PlaylistPageVideo[]; info: PlaylistPage }; video: VideoPlay } = $props();

	let loopPlaylist: boolean = $state(false);
	let shufflePlaylist: boolean = $state(false);

	playlistSettingsStore.subscribe((playlistSetting) => {
		if (playlist.info.playlistId in playlistSetting) {
			loopPlaylist = playlistSetting[playlist.info.playlistId].loop;
			shufflePlaylist = playlistSetting[playlist.info.playlistId].shuffle;
		}
	});
</script>

<article
	style="height: 85vh; position: relative;scrollbar-width: none;"
	id="playlist"
	class="scroll no-padding surface-container border"
>
	<article class="no-elevate border" style="position: sticky; top: 0; z-index: 3;">
		<h6>{playlist.info.title}</h6>
		<p>
			{cleanNumber(playlist.info.viewCount)}
			{$_('views')} • {playlist.info.videoCount}
			{$_('videos')}
		</p>
		<p>
			{#if playlist.info.authorId}
				<a
					href={resolve(`/channel/[authorId]`, {
						authorId: playlist.info.authorId
					})}>{playlist.info.author}</a
				>
			{:else}
				{playlist.info.author}
			{/if}
		</p>
		<nav>
			<button
				class="circle surface-container-highest"
				onclick={() => goToPreviousVideo(playlist.info.playlistId)}
			>
				<i>skip_previous</i>
				<div class="tooltip bottom">
					{$_('playlist.previous')}
				</div>
			</button>
			<button
				onclick={() => {
					loopPlaylist = !loopPlaylist;
					playlistSettingsStore.set({
						[playlist.info.playlistId]: { loop: loopPlaylist, shuffle: shufflePlaylist }
					});
				}}
				class="circle"
				class:surface-container-highest={!loopPlaylist}
			>
				<i>loop</i>
				<div class="tooltip bottom">
					{$_('playlist.loopPlaylist')}
				</div>
			</button>
			<button
				onclick={() => {
					shufflePlaylist = !shufflePlaylist;
					playlistSettingsStore.set({
						[playlist.info.playlistId]: { loop: loopPlaylist, shuffle: shufflePlaylist }
					});
				}}
				class="circle"
				class:surface-container-highest={!shufflePlaylist}
			>
				<i>shuffle</i>
				<div class="tooltip bottom">
					{$_('playlist.shuffleVideos')}
				</div>
			</button>
			<button
				class="circle surface-container-highest"
				onclick={async () => await goToNextVideo(video, playlist.info.playlistId)}
			>
				<i>skip_next</i>
				<div class="tooltip bottom">
					{$_('playlist.next')}
				</div>
			</button>
		</nav>

		<div class="space"></div>
		<div class="divider"></div>
	</article>

	<div class="space"></div>

	{#each playlist.videos as playlistVideo, index (index)}
		<article
			class="no-padding border"
			style="margin: .7em;"
			id={playlistVideo.videoId}
			class:primary-border={playlistVideo.videoId === video.videoId}
		>
			{#key playlistVideo.videoId}
				<VideoThumbnail
					video={playlistVideo}
					sideways={true}
					playlistId={playlist.info.playlistId || undefined}
				/>
			{/key}
		</article>
	{/each}
</article>
