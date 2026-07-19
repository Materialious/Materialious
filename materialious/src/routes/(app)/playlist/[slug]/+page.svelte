<script lang="ts">
	import { resolve } from '$app/paths';
	import { unsafeRandomItem } from '$lib/misc';
	import { cleanNumber } from '$lib/numbers';
	import {
		isAndroidTvStore,
		playlistSettingsStore
	} from '$lib/store';
	import { _ } from '$lib/i18n';
	import ItemsList from '$lib/components/layout/ItemsList.svelte';
	import Share from '$lib/components/Share.svelte';
	import PlaylistManager from '$lib/components/PlaylistManager.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { VideoWatchHistory } from '$lib/api/model.js';
	import { getWatchHistory } from '$lib/api/index.js';
	import PageLoading from '$lib/components/PageLoading.svelte';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let { data = $bindable() }: { data: any } = $props();
	let loaded = $state(false);
	let playlist: any = $state(null);

	data.streamed.details?.then((result: any) => {
		playlist = result;
		loaded = true;
	});

	async function loadLastWatched() {
		const videoIds = playlist.videos.map((video: any) => video.videoId);

		let lastHistory: VideoWatchHistory[] = [];

		let page = 0;
		while (true) {
			const historyPage = await getWatchHistory({ page, videoIds });

			if (historyPage.length === 0 || page > 999) break;

			lastHistory = historyPage;

			page++;
		}

		if (lastHistory.length > 0) {
			goto(
				resolve(
					$isAndroidTvStore
						? `/tv/[videoId]?playlist=${playlist.info.playlistId}`
						: `/watch/[videoId]?playlist=${playlist.info.playlistId}`,
					{
						videoId: lastHistory[0].videoId
					}
				)
			);
		} else {
			goto(
				resolve(
					$isAndroidTvStore
						? `/tv/[videoId]?playlist=${playlist.info.playlistId}`
						: `/watch/[videoId]?playlist=${playlist.info.playlistId}`,
					{
						videoId: playlist.videos[0].videoId
					}
				)
			);
		}
	}
</script>

{#if !loaded}
	<PageLoading />
{:else}
<article class="border padding">
	{#if playlist.videos.length > 0}
		<nav>
			<button onclick={loadLastWatched} class="button circle extra no-margin">
				<i>play_arrow</i>
				<div class="tooltip bottom">
					{$_('playlist.playVideos')}
				</div>
			</button>

			<a
				href={resolve(
					$isAndroidTvStore
						? `/tv/[playlistId]?playlist=${playlist.info.playlistId}`
						: `/watch/[playlistId]?playlist=${playlist.info.playlistId}`,
					{
						playlistId: unsafeRandomItem(playlist.videos).videoId
					}
				)}
				onclick={() =>
					playlistSettingsStore.set({
						[playlist.info.playlistId]: { shuffle: true, loop: false }
					})}
				class="button circle extra no-margin surface-container-highest"
			>
				<i>shuffle</i>
				<div class="tooltip bottom">
					{$_('playlist.shuffleVideos')}
				</div>
			</a>
		</nav>
	{/if}
	<h3>{playlist.info.title}</h3>
	<p>
		{cleanNumber(playlist.info.viewCount)}
		{$_('views')} • {playlist.info.videoCount}
		{$_('videos')}
	</p>
	<div class="divider" style="margin-bottom: 1em;"></div>

	<article style="max-height: 200px;" class="scroll no-padding no-elevate no-round">
		<p style="white-space: pre-line;word-wrap: break-word;">{playlist.info.description}</p>
	</article>

	<div class="space"></div>

	{#if !$isAndroidTvStore}
		<nav class="right-align">
			{#if playlist.videos.length > 0}
				<PlaylistManager
					mode="clone"
					videoIds={playlist.videos.map((v: any) => v.videoId)}
					buttonIcon="content_copy"
					buttonText={$_('playlist.cloneToPlaylist')}
				/>
			{/if}
			<Share
				iconOnly={false}
				shares={[
					{
						type: 'materialious',
						path: resolve('/playlist/[playlistId]', { playlistId: page.params.slug })
					},
					{
						type: 'invidious',
						path: `/playlist?list=${page.params.slug}`
					},
					{
						type: 'invidious redirect',
						path: `/playlist?list=${page.params.slug}`
					},
					{
						type: 'youtube',
						path: `/playlist?list=${page.params.slug}`
					}
				]}
			/>
		</nav>
	{/if}
</article>

<div class="space"></div>

<ItemsList items={playlist.videos} playlistId={playlist.info.playlistId} />
{/if}
