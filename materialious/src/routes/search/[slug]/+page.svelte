<script lang="ts">
	import { getSearch } from '$lib/Api';
	import ChannelThumbnail from '$lib/ChannelThumbnail.svelte';
	import PlaylistThumbnail from '$lib/PlaylistThumbnail.svelte';
	import Thumbnail from '$lib/Thumbnail.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { activePage } from '../../../store';

	export let data;

	let currentPage = 1;

	$: search = data.search;

	activePage.set(null);

	async function handleScroll() {
		const { scrollTop, clientHeight, scrollHeight } = document.documentElement;
		if (scrollTop + clientHeight >= scrollHeight - 5) {
			currentPage += 1;
			search = [...search, ...(await getSearch(data.slug, { page: currentPage.toString() }))];
		}
	}

	onMount(() => {
		window.addEventListener('scroll', handleScroll);
	});

	onDestroy(() => {
		window.removeEventListener('scroll', handleScroll);
	});
</script>

<div class="space" style="margin-bottom: 1em;">
	<div class="tabs left-align min">
		<a class="active">
			<i>home</i>
			<span>All</span>
		</a>
		<a>
			<i>movie</i>
			<span>Videos</span>
		</a>
		<a>
			<i>playlist_add_check</i>
			<span>Playlists</span>
		</a>
		<a>
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
				<article class="no-padding" style="height: 100%;">
					{#if item.type === 'video'}
						<Thumbnail video={item} />
					{:else if item.type === 'channel'}
						<ChannelThumbnail channel={item} />
					{:else if item.type === 'playlist'}
						<PlaylistThumbnail playlist={item} />
					{/if}
				</article>
			</div>
		{/each}
	</div>
</div>
