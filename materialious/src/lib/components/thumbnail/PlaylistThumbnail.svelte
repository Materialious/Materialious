<script lang="ts">
	import { getBestThumbnail, imageHandleCors } from '$lib/images';
	import { resolve } from '$app/paths';
	import { letterCase } from '$lib/letterCasing';
	import { _ } from '$lib/i18n';
	import type { Playlist, PlaylistPage } from '$lib/api/model';
	import { truncate } from '$lib/misc';
	import { Avatar } from 'melt/builders';
	import { mergeAttrs } from 'melt';

	interface Props {
		playlist: Playlist | PlaylistPage;
	}

	let { playlist }: Props = $props();

	const playlistLink = resolve('/playlist/[playlistId]', { playlistId: playlist.playlistId });

	let thumbnailSrc = '';
	if (playlist.videos && playlist.videos.length > 0) {
		thumbnailSrc = getBestThumbnail(playlist.videos[0].videoThumbnails) || '';
	} else if (playlist.playlistThumbnail) {
		thumbnailSrc = playlist.playlistThumbnail;
	}

	const thumbnail = new Avatar({ src: imageHandleCors(thumbnailSrc) });
</script>

<a href={playlistLink} style="width: 100%; overflow: hidden;min-height:100px;" class="wave">
	<img
		class="responsive"
		{...mergeAttrs(thumbnail.image, {
			style: 'max-width: 100%;height: 100%;'
		})}
		alt="Thumbnail for playlist"
	/>
	<div {...thumbnail.fallback} class="secondary-container responsive" style="height: 200px;"></div>

	<div class="absolute right bottom small-margin black white-text small-text thumbnail-corner">
		{playlist.videoCount}
		{$_('videos')}
	</div>
</a>

<div class="small-padding">
	<nav class="no-margin">
		<div class="max">
			<a href={playlistLink}><div class="bold">{letterCase(truncate(playlist.title))}</div></a>
			<div>
				{#if playlist.authorId}
					<a href={resolve('/channel/[authorId]', { authorId: playlist.authorId })}
						>{playlist.author}</a
					>
				{:else}
					<p>{playlist.author}</p>
				{/if}
			</div>
		</div>
	</nav>
</div>
