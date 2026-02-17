<script lang="ts">
	import { getChannelContent, searchChannelContent } from '$lib/api';
	import type { ChannelContent, ChannelContentTypes, ChannelSortBy } from '$lib/api/model';
	import PageLoading from '$lib/components/PageLoading.svelte';
	import { proxyGoogleImage } from '$lib/images';
	import { cleanNumber } from '$lib/numbers';
	import { channelCacheStore, interfaceLowBandwidthMode, isAndroidTvStore } from '$lib/store';
	import { Clipboard } from '@capacitor/clipboard';
	import { Capacitor } from '@capacitor/core';
	import { _ } from '$lib/i18n';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import ItemsList from '$lib/components/layout/ItemsList.svelte';
	import Author from '$lib/components/Author.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { isYTBackend } from '$lib/misc';

	let tab: ChannelContentTypes = $state('videos');

	let sortBy: ChannelSortBy = $state('newest');
	const sortByOptions: ChannelSortBy[] = ['newest', 'oldest', 'popular'];

	let showSearch: boolean = $state(false);
	let channelSearch: string = $state('');

	let displayContent: ChannelContent | undefined = $state(undefined);

	onMount(() => {
		displayContent = $channelCacheStore[page.params.slug].displayContent.videos;
	});

	async function searchChannel() {
		displayContent = await searchChannelContent(page.params.slug, channelSearch);
	}

	async function loadMore(event: InfiniteEvent) {
		if (typeof displayContent === 'undefined') return;

		let completed = false;
		let newContent: ChannelContent;
		if (displayContent.getContinuation) {
			newContent = await displayContent.getContinuation();
			displayContent.getContinuation = newContent.getContinuation;

			completed = newContent.getContinuation === undefined;
		} else {
			if (typeof displayContent.continuation === 'undefined') {
				event.detail.complete();
				return;
			}

			newContent = await getChannelContent(page.params.slug, {
				type: tab,
				continuation: displayContent.continuation,
				sortBy: sortBy
			});

			completed = displayContent.continuation === newContent.continuation;
			displayContent.continuation = newContent.continuation;
		}

		if ('videos' in newContent && 'videos' in displayContent) {
			if (completed) {
				event.detail.complete();
			} else {
				event.detail.loaded();
			}

			displayContent.videos = [...displayContent.videos, ...newContent.videos];
		} else if ('playlists' in displayContent && 'playlists' in newContent) {
			if (completed) {
				event.detail.complete();
			} else {
				event.detail.loaded();
			}

			displayContent.playlists = [...displayContent.playlists, ...newContent.playlists];
		}
	}

	async function changeTab(newTab: 'videos' | 'playlists' | 'streams' | 'shorts') {
		tab = newTab;
		displayContent = undefined;
		displayContent = await getChannelContent(page.params.slug, { type: tab });
	}
</script>

<div class="padding">
	{#if $channelCacheStore[page.params.slug].channel.authorBanners.length > 0 && !$interfaceLowBandwidthMode}
		<img
			loading="lazy"
			src={proxyGoogleImage($channelCacheStore[page.params.slug].channel.authorBanners[0].url)}
			width="100%"
			alt="Channel banner"
		/>
	{/if}
	<div class="description">
		<div>
			<Author
				channel={{
					...$channelCacheStore[page.params.slug].channel,
					subCountText: cleanNumber($channelCacheStore[page.params.slug].channel.subCount)
				}}
			/>
			<p style="width: 60vw;max-height: 150px;overflow: scroll;">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html $channelCacheStore[page.params.slug].channel.description}
			</p>
		</div>
		{#if !$isAndroidTvStore}
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
								string: `https://www.youtube.com/channel/${page.params.slug}`
							});
							(document.activeElement as HTMLElement)?.blur();
						}}
					>
						{$_('player.share.youtubeLink')}
					</li>
				</menu>
			</button>
		{/if}
	</div>

	<div class="tabs left-align scroll">
		{#if $channelCacheStore[page.params.slug].channel.tabs.includes('videos')}
			<a class:active={tab === 'videos'} onclick={() => changeTab('videos')} href="#video">
				<i>movie</i>
				<span>{$_('videoTabs.videos')}</span>
			</a>
		{/if}
		{#if $channelCacheStore[page.params.slug].channel.tabs.includes('shorts')}
			<a class:active={tab === 'shorts'} onclick={() => changeTab('shorts')} href="#short">
				<i>smartphone</i>
				<span>{$_('videoTabs.shorts')}</span>
			</a>
		{/if}
		{#if $channelCacheStore[page.params.slug].channel.tabs.includes('streams')}
			<a class:active={tab === 'streams'} onclick={() => changeTab('streams')} href="#stream">
				<i>stream</i>
				<span>{$_('videoTabs.streams')}</span>
			</a>
		{/if}
		{#if $channelCacheStore[page.params.slug].channel.tabs.includes('playlists')}
			<a class:active={tab === 'playlists'} onclick={() => changeTab('playlists')} href="#playlist">
				<i>playlist_add_check</i>
				<span>{$_('videoTabs.playlists')}</span>
			</a>
		{/if}
	</div>

	<div class="grid">
		<div class="s12 m6 l6">
			<nav class="group">
				{#each sortByOptions as sortingOption (sortingOption)}
					<button
						class="no-round"
						onclick={async () => {
							sortBy = sortingOption;

							displayContent = await getChannelContent(page.params.slug, {
								type: tab,
								sortBy: sortBy
							});
						}}
						class:active={sortBy === sortingOption}>{$_(sortingOption)}</button
					>
				{/each}
			</nav>
		</div>
		{#if !isYTBackend()}
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
		{/if}
	</div>
</div>

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
