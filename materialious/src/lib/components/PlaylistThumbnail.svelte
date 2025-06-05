<script lang="ts">
	import { getBestThumbnail } from '$lib/images';
	import { letterCase } from '$lib/letterCasing';
	import { onMount } from 'svelte';
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import type { Playlist } from '../api/model';
	import { insecureRequestImageHandler, truncate } from '../misc';
	import { interfaceLowBandwidthMode } from '../store';

	interface Props {
		playlist: Playlist;
		disabled?: boolean;
	}

	let { playlist, disabled = false }: Props = $props();

	let loading = $state(true);

	let img: HTMLImageElement | undefined = $state();

	const playlistLink = `/playlist/${playlist.playlistId}`;

	onMount(async () => {
		if (get(interfaceLowBandwidthMode)) return;

		let imgSrc = '';

		if (playlist.videos.length > 0) {
			imgSrc = getBestThumbnail(playlist.videos[0].videoThumbnails) || '';
		} else if (playlist.playlistThumbnail) {
			imgSrc = playlist.playlistThumbnail;
		} else {
			imgSrc = '';
			loading = false;
			return;
		}

		img = await insecureRequestImageHandler(imgSrc);

		img.onload = () => {
			loading = false;
		};
		img.onerror = () => {
			loading = false;
		};
	});
</script>

<a
	href={playlistLink}
	class:link-disabled={disabled}
	style="width: 100%; overflow: hidden;min-height:100px;"
	class="wave"
>
	{#if playlist.videoCount > 0 && !$interfaceLowBandwidthMode}
		{#if loading}
			<progress class="circle"></progress>
		{:else if img && img.src !== ''}
			<img
				class="responsive"
				style="max-width: 100%;height: 100%;"
				src={img.src}
				alt="Thumbnail for playlist"
			/>
		{/if}
	{:else}
		<h6 style="margin: 3em 0;">No image</h6>
	{/if}
	<div class="absolute right bottom small-margin black white-text small-text thumbnail-corner">
		{playlist.videoCount}
		{$_('videos')}
	</div>
</a>

<div class="small-padding">
	<nav class="no-margin">
		<div class="max">
			<a class:link-disabled={disabled} href={playlistLink}
				><div class="bold">{letterCase(truncate(playlist.title))}</div></a
			>
			<div>
				<a class:link-disabled={playlist.authorId === null} href={`/channel/${playlist.authorId}`}
					>{playlist.author}</a
				>
			</div>
		</div>
	</nav>
</div>

<style>
	.link-disabled {
		pointer-events: none;
	}
</style>
