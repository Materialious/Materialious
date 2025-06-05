<script lang="ts">
	import { getSearch } from '$lib/api';
	import ChannelThumbnail from '$lib/components/ChannelThumbnail.svelte';
	import ContentColumn from '$lib/components/ContentColumn.svelte';
	import HashtagThumbnail from '$lib/components/HashtagThumbnail.svelte';
	import PageLoading from '$lib/components/PageLoading.svelte';
	import PlaylistThumbnail from '$lib/components/PlaylistThumbnail.svelte';
	import Thumbnail from '$lib/components/Thumbnail.svelte';
	import { extractUniqueId } from '$lib/misc.js';
	import { feedLastItemId, searchCacheStore } from '$lib/store.js';
	import { onMount } from 'svelte';
	import { _ } from '$lib/i18n';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';

	let { data } = $props();

	let currentType: 'playlist' | 'all' | 'video' | 'channel' = $state('all');
	let currentPage = 1;

	onMount(() => {
		if ($feedLastItemId) {
			document
				.getElementById($feedLastItemId)
				?.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
		}
	});

	async function changeType(type: 'playlist' | 'all' | 'video' | 'channel') {
		currentType = type;
		currentPage = 1;
		data.searchStoreId = type + data.slug;
		searchCacheStore.set({ [data.searchStoreId]: await getSearch(data.slug, { type: type }) });
	}

	async function loadMore(event: InfiniteEvent) {
		currentPage++;
		const newSearch = await getSearch(data.slug, {
			page: currentPage.toString(),
			type: currentType
		});

		if (newSearch.length === 0) {
			event.detail.complete();
		} else {
			searchCacheStore.set({
				[data.searchStoreId]: [...($searchCacheStore[data.searchStoreId] ?? []), ...newSearch]
			});
			event.detail.loaded();
		}
	}
</script>

<div style="margin-top: 1em;">
	<div class="tabs left-align min scroll">
		<a class:active={currentType === 'all'} href="#all" onclick={async () => changeType('all')}>
			<i>home</i>
			<span>{$_('videoTabs.all')}</span>
		</a>
		<a
			class:active={currentType === 'video'}
			href="#videos"
			onclick={async () => changeType('video')}
		>
			<i>movie</i>
			<span>{$_('videoTabs.videos')}</span>
		</a>
		<a
			class:active={currentType === 'playlist'}
			href="#playlists"
			onclick={async () => changeType('playlist')}
		>
			<i>playlist_add_check</i>
			<span>{$_('videoTabs.playlists')}</span>
		</a>
		<a
			class:active={currentType === 'channel'}
			href="#channels"
			onclick={async () => changeType('channel')}
		>
			<i>person</i>
			<span>{$_('videoTabs.channels')}</span>
		</a>
	</div>
</div>

{#if $searchCacheStore[data.searchStoreId]}
	<div class="page right active">
		<div class="space"></div>
		<div class="grid">
			{#each $searchCacheStore[data.searchStoreId] as item}
				<ContentColumn>
					{#key item}
						<article
							class="no-padding"
							style="height: 100%;"
							onclick={() => feedLastItemId.set(extractUniqueId(item))}
							id={extractUniqueId(item)}
						>
							{#if item.type === 'video'}
								<Thumbnail video={item} />
							{:else if item.type === 'channel'}
								<ChannelThumbnail channel={item} />
							{:else if item.type === 'playlist'}
								<PlaylistThumbnail playlist={item} />
							{:else if item.type === 'hashtag'}
								<HashtagThumbnail hashtag={item} />
							{/if}
						</article>
					{/key}
				</ContentColumn>
			{/each}
		</div>
	</div>
{:else}
	<PageLoading />
{/if}

<InfiniteLoading on:infinite={loadMore} />
