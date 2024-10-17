<script lang="ts">
	import { amSubscribed, deleteUnsubscribe, getChannelContent, postSubscribe } from '$lib/Api';
	import type { ChannelContentPlaylists, ChannelContentVideos } from '$lib/Api/model';
	import ContentColumn from '$lib/ContentColumn.svelte';
	import PageLoading from '$lib/PageLoading.svelte';
	import PlaylistThumbnail from '$lib/PlaylistThumbnail.svelte';
	import VideoList from '$lib/VideoList.svelte';
	import { cleanNumber, getBestThumbnail, proxyGoogleImage } from '$lib/misc';
	import { activePageStore, authStore } from '$lib/store';
	import { Clipboard } from '@capacitor/clipboard';
	import { Capacitor } from '@capacitor/core';
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import { get } from 'svelte/store';

	export let data;

	activePageStore.set(null);

	let isSubscribed = false;

	let tab: 'videos' | 'playlists' | 'streams' | 'shorts' = 'videos';

	let displayContent: ChannelContentPlaylists | ChannelContentVideos | undefined = undefined;

	async function loadMore(event: InfiniteEvent) {
		if (typeof displayContent === 'undefined') return;

		if (typeof displayContent.continuation === 'undefined') {
			event.detail.complete();
			return;
		}

		const newContent = await getChannelContent(data.channel.authorId, {
			type: tab,
			continuation: displayContent.continuation
		});
		if ('videos' in newContent && 'videos' in displayContent) {
			if (displayContent.continuation === newContent.continuation) {
				event.detail.complete();
			} else {
				event.detail.loaded();
			}
			displayContent.videos = [...displayContent.videos, ...newContent.videos];
		} else if ('playlists' in displayContent && 'playlists' in newContent) {
			if (displayContent.continuation === newContent.continuation) {
				event.detail.complete();
			} else {
				event.detail.loaded();
			}
			displayContent.playlists = [...displayContent.playlists, ...newContent.playlists];
		}
		displayContent.continuation = newContent.continuation;
	}

	async function changeTab(newTab: 'videos' | 'playlists' | 'streams' | 'shorts') {
		tab = newTab;
		displayContent = undefined;
		displayContent = await getChannelContent(data.channel.authorId, { type: tab });
	}

	let channelPfp: string;
	onMount(async () => {
		displayContent = await getChannelContent(data.channel.authorId, { type: 'videos' });

		const channelPfpResp = await fetch(
			proxyGoogleImage(getBestThumbnail(data.channel.authorThumbnails))
		);
		channelPfp = URL.createObjectURL(await channelPfpResp.blob());

		if (get(authStore)) {
			isSubscribed = await amSubscribed(data.channel.authorId);
		}
	});

	async function toggleSubscribed() {
		if (isSubscribed) {
			await deleteUnsubscribe(data.channel.authorId);
		} else {
			await postSubscribe(data.channel.authorId);
		}

		isSubscribed = !isSubscribed;
	}
</script>

<div class="padding">
	{#if data.channel.authorBanners.length > 0}
		<img
			src={proxyGoogleImage(data.channel.authorBanners[0].url)}
			width="100%"
			alt="Channel banner"
		/>
	{/if}
	<div class="description">
		{#if channelPfp}
			<img
				style="margin-right: 1em;"
				class="circle extra m l"
				src={channelPfp}
				alt="Channel profile"
			/>
		{:else}
			<progress style="padding: 15px;" class="circle"></progress>
		{/if}

		<div>
			<h2>{data.channel.author}</h2>
			<p>{cleanNumber(data.channel.subCount)} {$_('subscribers')}</p>
			<p style="width: 60vw;">{data.channel.description}</p>
		</div>
		<div class="grid no-padding">
			<div class="s12 m12 l5">
				<button
					on:click={toggleSubscribed}
					class:inverse-surface={!isSubscribed}
					class:border={isSubscribed}
				>
					{#if !isSubscribed}
						{$_('subscribe')}
					{:else}
						{$_('unsubscribe')}
					{/if}
				</button>
			</div>

			<div class="s12 m12 l5">
				<button class="border">
					<i>share</i>
					<span>{$_('player.share.title')}</span>
					<menu class="no-wrap">
						{#if !Capacitor.isNativePlatform()}
							<a
								href="#share"
								on:click={async () => {
									await Clipboard.write({ string: location.href });
								}}>{$_('player.share.materialiousLink')}</a
							>
						{/if}
						<a
							href="#share"
							on:click={async () => {
								await Clipboard.write({
									string: `https://www.youtube.com/channel/${data.channel.authorId}`
								});
							}}>{$_('player.share.youtubeLink')}</a
						>
					</menu>
				</button>
			</div>
		</div>
	</div>

	<div class="tabs left-align scroll">
		{#if data.channel.tabs.includes('videos')}
			<a class:active={tab === 'videos'} on:click={() => changeTab('videos')} href={`#video`}>
				<i>movie</i>
				<span>{$_('videoTabs.videos')}</span>
			</a>
		{/if}
		{#if data.channel.tabs.includes('shorts')}
			<a class:active={tab === 'shorts'} on:click={() => changeTab('shorts')} href={`#short`}>
				<i>smartphone</i>
				<span>{$_('videoTabs.shorts')}</span>
			</a>
		{/if}
		{#if data.channel.tabs.includes('streams')}
			<a class:active={tab === 'streams'} on:click={() => changeTab('streams')} href={`#stream`}>
				<i>stream</i>
				<span>{$_('videoTabs.streams')}</span>
			</a>
		{/if}
		{#if data.channel.tabs.includes('playlists')}
			<a
				class:active={tab === 'playlists'}
				on:click={() => changeTab('playlists')}
				href={`#playlist`}
			>
				<i>playlist_add_check</i>
				<span>{$_('videoTabs.playlists')}</span>
			</a>
		{/if}
	</div>
</div>

{#if displayContent}
	{#if 'videos' in displayContent}
		<VideoList videos={displayContent.videos} />
	{:else}
		<div class="page right active">
			<div class="space"></div>
			<div class="grid">
				{#each displayContent.playlists as playlist}
					<ContentColumn>
						<article class="no-padding" style="height: 100%;">
							<PlaylistThumbnail {playlist} />
						</article>
					</ContentColumn>
				{/each}
			</div>
		</div>
	{/if}

	<InfiniteLoading on:infinite={loadMore} />
{:else}
	<PageLoading />
{/if}

<style>
	.description {
		display: flex;
		padding: 1em 0;
		justify-content: center;
	}

	@media screen and (max-width: 1350px) {
		.description {
			flex-direction: column;
			align-items: flex-start;
		}
	}

	.tabs {
		text-transform: capitalize;
	}
</style>
