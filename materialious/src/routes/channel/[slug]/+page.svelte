<script lang="ts">
	import { amSubscribed, deleteUnsubscribe, getChannelContent, postSubscribe } from '$lib/Api';
	import type { ChannelContentPlaylists, ChannelContentVideos } from '$lib/Api/model';
	import PageLoading from '$lib/PageLoading.svelte';
	import PlaylistThumbnail from '$lib/PlaylistThumbnail.svelte';
	import Thumbnail from '$lib/Thumbnail.svelte';
	import { cleanNumber } from '$lib/misc';
	import { onDestroy, onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { activePage, auth } from '../../../store';

	export let data;

	activePage.set(null);

	let isSubscribed = false;

	let tab: 'videos' | 'playlists' | 'streams' | 'shorts' = 'videos';

	let displayContent: ChannelContentPlaylists | ChannelContentVideos | undefined = undefined;

	async function handleScroll() {
		if (typeof displayContent === 'undefined') return;

		const { scrollTop, clientHeight, scrollHeight } = document.documentElement;
		if (scrollTop + clientHeight >= scrollHeight - 5) {
			const newContent = await getChannelContent(data.channel.authorId, {
				type: tab,
				continuation: displayContent.continuation
			});
			if ('videos' in newContent && 'videos' in displayContent) {
				displayContent.videos = [...displayContent.videos, ...newContent.videos];
			} else if ('playlists' in displayContent && 'playlists' in newContent) {
				displayContent.playlists = [...displayContent.playlists, ...newContent.playlists];
			}
			displayContent.continuation = newContent.continuation;
		}
	}

	async function changeTab(newTab: 'videos' | 'playlists' | 'streams' | 'shorts') {
		tab = newTab;
		displayContent = undefined;
		displayContent = await getChannelContent(data.channel.authorId, { type: tab });
	}

	onMount(async () => {
		displayContent = await getChannelContent(data.channel.authorId, { type: 'videos' });

		if (get(auth)) {
			isSubscribed = await amSubscribed(data.channel.authorId);
		}

		window.addEventListener('scroll', handleScroll);
	});

	onDestroy(() => {
		window.removeEventListener('scroll', handleScroll);
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
		<img src={data.channel.authorBanners[0].url} width="100%" alt="Channel banner" />
	{/if}
	<div class="description">
		<img
			style="margin-right: 1em;"
			class="circle extra m l"
			src={data.channel.authorThumbnails[5].url}
			alt="Channel profile"
		/>
		<div>
			<h2>{data.channel.author}</h2>
			<p>{cleanNumber(data.channel.subCount)} subscribers</p>
			<p style="width: 60vw;">{data.channel.description}</p>
		</div>
		<button
			on:click={toggleSubscribed}
			class:inverse-surface={!isSubscribed}
			class:border={isSubscribed}
		>
			{#if !isSubscribed}
				Subscribe
			{:else}
				Unsubscribe
			{/if}
		</button>
	</div>

	<div class="tabs left-align">
		<a class:active={tab === 'videos'} on:click={() => changeTab('videos')} href={`#video`}>
			<i>movie</i>
			<span>Videos</span>
		</a>
		<a class:active={tab === 'shorts'} on:click={() => changeTab('shorts')} href={`#short`}>
			<i>smartphone</i>
			<span>Shorts</span>
		</a>
		<a class:active={tab === 'streams'} on:click={() => changeTab('streams')} href={`#stream`}>
			<i>stream</i>
			<span>Streams</span>
		</a>
		<a
			class:active={tab === 'playlists'}
			on:click={() => changeTab('playlists')}
			href={`#playlist`}
		>
			<i>playlist_add_check</i>
			<span>Playlists</span>
		</a>
	</div>
</div>

{#if displayContent}
	<div class="page right active">
		<div class="space"></div>
		<div class="grid">
			{#if 'videos' in displayContent}
				{#each displayContent.videos as video}
					<div class="s12 m6 l2">
						<article class="no-padding" style="height: 100%;">
							<Thumbnail {video} />
						</article>
					</div>
				{/each}
			{:else}
				{#each displayContent.playlists as playlist}
					<div class="s12 m6 l2">
						<article class="no-padding" style="height: 100%;">
							<PlaylistThumbnail {playlist} />
						</article>
					</div>
				{/each}
			{/if}
		</div>
	</div>
{:else}
	<PageLoading />
{/if}

<style>
	.description {
		display: flex;
		padding: 1em 0;
		justify-content: center;
	}

	.tabs {
		text-transform: capitalize;
	}
</style>
