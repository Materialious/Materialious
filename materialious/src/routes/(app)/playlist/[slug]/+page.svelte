<script lang="ts">
	import { resolve } from '$app/paths';
	import { unsafeRandomItem } from '$lib/misc';
	import { cleanNumber } from '$lib/numbers';
	import { isAndroidTvStore, playlistSettingsStore } from '$lib/store';
	import { Clipboard } from '@capacitor/clipboard';
	import { Capacitor } from '@capacitor/core';
	import { _ } from '$lib/i18n';
	import ItemsList from '$lib/components/ItemsList.svelte';

	let { data } = $props();
</script>

<article class="border padding">
	{#if data.playlist.videos}
		<nav>
			<a
				href={!$isAndroidTvStore
					? resolve(`/watch/${data.playlist.videos[0].videoId}?playlist=${data.playlist.info.playlistId}`)
					: resolve(`/tv/${data.playlist.videos[0].videoId}?playlist=${data.playlist.info.playlistId}`)}
				class="button circle extra no-margin"
			>
				<i>play_arrow</i>
				<div class="tooltip bottom">
					{$_('playlist.playVideos')}
				</div>
			</a>

			<a
				href={!$isAndroidTvStore
					? resolve(`/watch/${unsafeRandomItem(data.playlist.videos).videoId}?playlist=${data.playlist.info.playlistId}`)
					: resolve(`/tv/${unsafeRandomItem(data.playlist.videos).videoId}?playlist=${data.playlist.info.playlistId}`)}
				onclick={() =>
					playlistSettingsStore.set({
						[data.playlist.info.playlistId]: { shuffle: true, loop: false }
					})}
				class="button circle extra no-margin border"
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
		<button class="border no-margin">
			<i>share</i>
			<span>{$_('player.share.title')}</span>
			<menu class="no-wrap mobile">
				{#if !Capacitor.isNativePlatform()}
					<li
						class="row"
						role="presentation"
						onclick={async () => {
							await Clipboard.write({ string: location.href });
							(document.activeElement as HTMLElement)?.blur();
						}}
					>
						{$_('player.share.materialiousLink')}
					</li>
				{/if}
				<li
					class="row"
					role="presentation"
					onclick={async () => {
						await Clipboard.write({
							string: `https://www.youtube.com/playlist?list=${data.playlist.info.playlistId}`
						});
						(document.activeElement as HTMLElement)?.blur();
					}}
				>
					{$_('player.share.youtubeLink')}
				</li>
			</menu>
		</button>
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
