<script lang="ts">
	import {
		amSubscribed,
		deleteUnsubscribe,
		getChannelContent,
		postSubscribe,
		searchChannelContent,
		type channelContentTypes,
		type channelSortBy
	} from '$lib/api';
	import type { ChannelContentPlaylists, ChannelContentVideos } from '$lib/api/model';
	import PageLoading from '$lib/components/PageLoading.svelte';
	import { getBestThumbnail, proxyGoogleImage } from '$lib/images';
	import { cleanNumber } from '$lib/numbers';
	import { authStore, interfaceLowBandwidthMode, isAndroidTvStore } from '$lib/store';
	import { Clipboard } from '@capacitor/clipboard';
	import { Capacitor } from '@capacitor/core';
	import { onMount } from 'svelte';
	import { _ } from '$lib/i18n';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import { get } from 'svelte/store';
	import ItemsList from '$lib/components/ItemsList.svelte';

	let { data } = $props();

	let isSubscribed = $state(false);

	let tab: channelContentTypes = $state('videos');

	let sortBy: channelSortBy = $state('newest');
	const sortByOptions: channelSortBy[] = ['newest', 'oldest', 'popular'];

	let showSearch: boolean = $state(false);
	let channelSearch: string = $state('');

	let displayContent: ChannelContentPlaylists | ChannelContentVideos | undefined =
		$state(undefined);

	async function searchChannel() {
		displayContent = await searchChannelContent(data.channel.authorId, channelSearch);
	}

	async function loadMore(event: InfiniteEvent) {
		if (typeof displayContent === 'undefined') return;

		if (typeof displayContent.continuation === 'undefined') {
			event.detail.complete();
			return;
		}

		const newContent = await getChannelContent(data.channel.authorId, {
			type: tab,
			continuation: displayContent.continuation,
			sortBy: sortBy
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

	let channelPfp: string | undefined = $state();
	onMount(async () => {
		displayContent = await getChannelContent(data.channel.authorId, {
			type: 'videos',
			sortBy: sortBy
		});

		if (!get(interfaceLowBandwidthMode)) {
			const channelPfpResp = await fetch(
				proxyGoogleImage(getBestThumbnail(data.channel.authorThumbnails))
			);
			channelPfp = URL.createObjectURL(await channelPfpResp.blob());
		}

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
	{#if data.channel.authorBanners.length > 0 && !$interfaceLowBandwidthMode}
		<img
			loading="lazy"
			src={proxyGoogleImage(data.channel.authorBanners[0].url)}
			width="100%"
			alt="Channel banner"
		/>
	{/if}
	<div class="description">
		{#if !$interfaceLowBandwidthMode}
			{#if channelPfp}
				<img
					loading="lazy"
					style="margin-right: 1em;"
					class="circle extra m l"
					src={channelPfp}
					alt="Channel profile"
				/>
			{:else}
				<progress style="padding: 15px;" class="circle"></progress>
			{/if}
		{/if}

		<div>
			<h2>{data.channel.author}</h2>
			<p>{cleanNumber(data.channel.subCount)} {$_('subscribers')}</p>
			<p style="width: 60vw;">{data.channel.description}</p>
		</div>
		<div class="grid no-padding">
			<div class="s12 m12 l5">
				<button
					onclick={toggleSubscribed}
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

			{#if !$isAndroidTvStore}
				<div class="s12 m12 l5">
					<button class="border">
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
										string: `https://www.youtube.com/channel/${data.channel.authorId}`
									});
									(document.activeElement as HTMLElement)?.blur();
								}}
							>
								{$_('player.share.youtubeLink')}
							</li>
						</menu>
					</button>
				</div>
			{/if}
		</div>
	</div>

	<div class="tabs left-align scroll">
		{#if data.channel.tabs.includes('videos')}
			<a class:active={tab === 'videos'} onclick={() => changeTab('videos')} href={`#video`}>
				<i>movie</i>
				<span>{$_('videoTabs.videos')}</span>
			</a>
		{/if}
		{#if data.channel.tabs.includes('shorts')}
			<a class:active={tab === 'shorts'} onclick={() => changeTab('shorts')} href={`#short`}>
				<i>smartphone</i>
				<span>{$_('videoTabs.shorts')}</span>
			</a>
		{/if}
		{#if data.channel.tabs.includes('streams')}
			<a class:active={tab === 'streams'} onclick={() => changeTab('streams')} href={`#stream`}>
				<i>stream</i>
				<span>{$_('videoTabs.streams')}</span>
			</a>
		{/if}
		{#if data.channel.tabs.includes('playlists')}
			<a
				class:active={tab === 'playlists'}
				onclick={() => changeTab('playlists')}
				href={`#playlist`}
			>
				<i>playlist_add_check</i>
				<span>{$_('videoTabs.playlists')}</span>
			</a>
		{/if}
	</div>
</div>

<div class="grid">
	<div class="s12 m6 l6">
		<nav class="group">
			{#each sortByOptions as sortingOption}
				<button
					class="no-round"
					onclick={async () => {
						sortBy = sortingOption;

						displayContent = await getChannelContent(data.channel.authorId, {
							type: tab,
							sortBy: sortBy
						});
					}}
					class:active={sortBy === sortingOption}>{$_(sortingOption)}</button
				>
			{/each}
		</nav>
	</div>
	<div class="s12 m6 l6">
		{#if showSearch}
			<div class="max field suffix prefix small no-margin surface-variant">
				<i class="front">search</i><input
					bind:value={channelSearch}
					oninput={searchChannel}
					type="text"
					placeholder={$_('searchPlaceholder')}
				/>
			</div>
		{:else}
			<nav class="right-align m l">
				<button onclick={() => (showSearch = true)}><i>search</i></button>
			</nav>
			<button class="s" onclick={() => (showSearch = true)}><i>search</i></button>
		{/if}
	</div>
</div>

<div class="space"></div>

{#if displayContent}
	{#if 'videos' in displayContent}
		<ItemsList items={displayContent.videos} />
	{:else}
		<ItemsList items={displayContent.playlists} />
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
