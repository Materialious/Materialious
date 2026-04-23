<script lang="ts">
	import { resolve } from '$app/paths';
	import { unsafeRandomItem } from '$lib/misc';
	import { cleanNumber } from '$lib/numbers';
	import { isAndroidTvStore, playlistSettingsStore } from '$lib/store';
	import { _ } from '$lib/i18n';
	import ItemsList from '$lib/components/layout/ItemsList.svelte';
	import Share from '$lib/components/Share.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { VideoWatchHistory } from '$lib/api/model.js';
	import { getWatchHistory } from '$lib/api/index.js';

	let { data } = $props();

	async function loadLastWatched() {
		const videoIds = data.playlist.videos.map((video) => video.videoId);

		let lastHistory: VideoWatchHistory[] = [];

		let page = 0;
		while (true) {
			const historyPage = await getWatchHistory({ page, videoIds });

			if (historyPage.length === 0) break;

			lastHistory = historyPage;

			page++;
		}

		if (lastHistory.length > 0) {
			goto(
				resolve(
					$isAndroidTvStore
						? `/tv/[videoId]?playlist=${data.playlist.info.playlistId}`
						: `/watch/[videoId]?playlist=${data.playlist.info.playlistId}`,
					{
						videoId: lastHistory[0].videoId
					}
				)
			);
		} else {
			goto(
				resolve(
					$isAndroidTvStore
						? `/tv/[videoId]?playlist=${data.playlist.info.playlistId}`
						: `/watch/[videoId]?playlist=${data.playlist.info.playlistId}`,
					{
						videoId: data.playlist.videos[0].videoId
					}
				)
			);
		}
	}
</script>

<article class="border padding">
	{#if data.playlist.videos.length > 0}
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
						? `/tv/[playlistId]?playlist=${data.playlist.info.playlistId}`
						: `/watch/[playlistId]?playlist=${data.playlist.info.playlistId}`,
					{
						playlistId: unsafeRandomItem(data.playlist.videos).videoId
					}
				)}
				onclick={() =>
					playlistSettingsStore.set({
						[data.playlist.info.playlistId]: { shuffle: true, loop: false }
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
	<h3>{data.playlist.info.title}</h3>
	<p>
		{cleanNumber(data.playlist.info.viewCount)}
		{$_('views')} • {data.playlist.info.videoCount}
		{$_('videos')}
	</p>
	<div class="divider" style="margin-bottom: 1em;"></div>

	<article style="max-height: 200px;" class="scroll no-padding no-elevate no-round">
		<p style="white-space: pre-line;word-wrap: break-word;">{data.playlist.info.description}</p>
	</article>

	<div class="space"></div>

	{#if !$isAndroidTvStore}
		<nav class="right-align">
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

<ItemsList items={data.playlist.videos} playlistId={data.playlist.info.playlistId} />
