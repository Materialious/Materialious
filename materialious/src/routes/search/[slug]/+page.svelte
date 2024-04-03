<script lang="ts">
	import { page } from '$app/stores';
	import { getSearch } from '$lib/Api';
	import ChannelThumbnail from '$lib/ChannelThumbnail.svelte';
	import PlaylistThumbnail from '$lib/PlaylistThumbnail.svelte';
	import Thumbnail from '$lib/Thumbnail.svelte';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import { activePage } from '../../../store';

	export let data;

	let currentPage = 1;

	$: search = data.search;

	activePage.set(null);

	function changeType(type: string) {
		$page.url.searchParams.set('type', type);
		document.location.href = $page.url.href;
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
			search = [...search, ...newSearch];
			event.detail.loaded();
		}
	}
</script>

<div class="space" style="margin-bottom: 1em;">
	<div class="tabs left-align min scroll">
		<a class:active={data.searchType === 'all'} href="#all" on:click={() => changeType('all')}>
			<i>home</i>
			<span>All</span>
		</a>
		<a
			class:active={data.searchType === 'video'}
			href="#videos"
			on:click={() => changeType('video')}
		>
			<i>movie</i>
			<span>Videos</span>
		</a>
		<a
			class:active={data.searchType === 'playlist'}
			href="#playlists"
			on:click={() => changeType('playlist')}
		>
			<i>playlist_add_check</i>
			<span>Playlists</span>
		</a>
		<a
			class:active={data.searchType === 'channel'}
			href="#channels"
			on:click={() => changeType('channel')}
		>
			<i>person</i>
			<span>Channels</span>
		</a>
	</div>
</div>

<div class="page right active">
	<div class="space"></div>
	<div class="grid">
		{#each search as item}
			<div class="s12 m6 l2">
				{#key data.search}
					<article class="no-padding" style="height: 100%;">
						{#if item.type === 'video'}
							<Thumbnail video={item} />
						{:else if item.type === 'channel'}
							<ChannelThumbnail channel={item} />
						{:else if item.type === 'playlist'}
							<PlaylistThumbnail playlist={item} />
						{/if}
					</article>
				{/key}
			</div>
		{/each}
	</div>
</div>

<InfiniteLoading on:infinite={loadMore} />
