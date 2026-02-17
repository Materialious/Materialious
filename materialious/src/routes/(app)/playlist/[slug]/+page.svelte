<script lang="ts">
	import { resolve } from '$app/paths';
	import { unsafeRandomItem } from '$lib/misc';
	import { cleanNumber } from '$lib/numbers';
	import { isAndroidTvStore, playlistSettingsStore } from '$lib/store';
	import { _ } from '$lib/i18n';
	import ItemsList from '$lib/components/layout/ItemsList.svelte';
	import Share from '$lib/components/Share.svelte';
	import { page } from '$app/state';

	let { data } = $props();
</script>

<article class="border padding">
	{#if data.playlist.videos}
		<nav>
			<a
				href={resolve(
					$isAndroidTvStore
						? `/tv/[playlistId]?playlist=${data.playlist.info.playlistId}`
						: `/watch/[playlistId]?playlist=${data.playlist.info.playlistId}`,
					{
						playlistId: data.playlist.videos[0].videoId
					}
				)}
				class="button circle extra no-margin"
			>
				<i>play_arrow</i>
				<div class="tooltip bottom">
					{$_('playlist.playVideos')}
				</div>
			</a>

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

{#if data.playlist.videos}
	<ItemsList
		items={data.playlist.videos}
		playlistAuthor={data.playlist.info.author}
		playlistId={data.playlist.info.playlistId}
	/>
{/if}
