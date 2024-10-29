<script lang="ts">
	import { getSearch } from '$lib/api';
	import ChannelThumbnail from '$lib/ChannelThumbnail.svelte';
	import ContentColumn from '$lib/ContentColumn.svelte';
	import HashtagThumbnail from '$lib/HashtagThumbnail.svelte';
	import PageLoading from '$lib/PageLoading.svelte';
	import PlaylistThumbnail from '$lib/PlaylistThumbnail.svelte';
	import { activePageStore } from '$lib/store';
	import Thumbnail from '$lib/Thumbnail.svelte';
	import { _ } from 'svelte-i18n';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';

	export let data;

	let currentPage = 1;

	activePageStore.set(null);

	async function changeType(type: 'playlist' | 'all' | 'video' | 'channel') {
		data.searchType = type;
		currentPage = 1;
		data.search = [];
		data.search = await getSearch(data.slug, { type: type });
	}

	async function loadMore(event: InfiniteEvent) {
		currentPage++;
		const newSearch = await getSearch(data.slug, {
			page: currentPage.toString(),
			type: data.searchType
		});

		if (newSearch.length === 0) {
			event.detail.complete();
		} else {
			data.search = [...data.search, ...newSearch];
			event.detail.loaded();
		}
	}
</script>

<div style="margin-top: 1em;">
	<div class="tabs left-align min scroll">
		<a
			class:active={data.searchType === 'all'}
			href="#all"
			on:click={async () => changeType('all')}
		>
			<i>home</i>
			<span>{$_('videoTabs.all')}</span>
		</a>
		<a
			class:active={data.searchType === 'video'}
			href="#videos"
			on:click={async () => changeType('video')}
		>
			<i>movie</i>
			<span>{$_('videoTabs.videos')}</span>
		</a>
		<a
			class:active={data.searchType === 'playlist'}
			href="#playlists"
			on:click={async () => changeType('playlist')}
		>
			<i>playlist_add_check</i>
			<span>{$_('videoTabs.playlists')}</span>
		</a>
		<a
			class:active={data.searchType === 'channel'}
			href="#channels"
			on:click={async () => changeType('channel')}
		>
			<i>person</i>
			<span>{$_('videoTabs.channels')}</span>
		</a>
	</div>
</div>

{#if data.search.length > 0}
	<div class="page right active">
		<div class="space"></div>
		<div class="grid">
			{#each data.search as item}
				<ContentColumn>
					{#key item}
						<article class="no-padding" style="height: 100%;">
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
