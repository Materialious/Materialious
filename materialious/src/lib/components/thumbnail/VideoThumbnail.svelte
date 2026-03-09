<script lang="ts">
	import { resolve } from '$app/paths';
	import { getBestThumbnail } from '$lib/images';
	import { letterCase } from '$lib/letterCasing';
	import { cleanNumber, videoLength } from '$lib/numbers';
	import { onDestroy, onMount } from 'svelte';
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import { Avatar } from 'melt/builders';
	import type {
		Notification,
		PlaylistPageVideo,
		Video,
		VideoBase,
		VideoWatchHistory
	} from '$lib/api/model';
	import { deArrowEnabledStore, isAndroidTvStore, playerState } from '$lib/store';
	import { relativeTimestamp } from '$lib/time';
	import { queueGetWatchHistory } from '$lib/api/historyPool';
	import { page } from '$app/state';
	import { getDeArrow, getThumbnailDeArrow } from '$lib/api/dearrow';
	import AuthorAvatar from '../AuthorAvatar.svelte';

	interface Props {
		video: VideoBase | Video | Notification | PlaylistPageVideo | VideoWatchHistory;
		playlistId?: string;
		sideways?: boolean;
	}

	let { video = $bindable(), playlistId = '', sideways = $bindable(false) }: Props = $props();

	const watchPath = resolve(`/${get(isAndroidTvStore) ? 'tv' : 'watch'}/[videoId]`, {
		videoId: video.videoId
	});
	const watchUrl = new URL(`${location.origin}${watchPath}`);

	if (playlistId !== '') {
		watchUrl.searchParams.set('playlist', playlistId);
	}

	let progress: string | undefined = $state();

	let thumbnailSrc = $state(
		'thumbnail' in video ? video.thumbnail : (getBestThumbnail(video.videoThumbnails) as string)
	);

	if (get(deArrowEnabledStore)) {
		try {
			getDeArrow(video.videoId, { priority: 'low' }).then(async (deArrow) => {
				for (const title of deArrow.titles) {
					if (title.locked || title.votes > 0) {
						video.title = title.title.replace('>', '');
						break;
					}
				}

				for (const thumbnail of deArrow.thumbnails) {
					if (thumbnail.locked || thumbnail.original || thumbnail.votes > 0) {
						if (thumbnail.timestamp !== null) {
							thumbnailSrc = await getThumbnailDeArrow(video.videoId, thumbnail.timestamp, {
								priority: 'low'
							});
						}
						break;
					}
				}
			});
		} catch {
			// Continue regardless of error
		}
	}

	let thumbnailHeight = $state(0);
	let thumbnailHTMLElement: HTMLImageElement | undefined = $state();

	const thumbnail = new Avatar({
		src: () => thumbnailSrc,
		onLoadingStatusChange: () => {
			if (thumbnailHTMLElement) thumbnailHeight = thumbnailHTMLElement.naturalHeight;
		}
	});

	let startedSideways = sideways === true;
	function disableSideways() {
		if (!startedSideways) return;

		if (window.innerWidth <= 1800) {
			sideways = false;
		} else sideways = true;
	}

	onMount(async () => {
		// Check if sideways should be enabled or disabled.
		disableSideways();

		addEventListener('resize', disableSideways);

		if (!page.url.pathname.endsWith('/history'))
			queueGetWatchHistory(video.videoId).then((watchHistory) => {
				if (watchHistory) {
					progress = watchHistory.progress.toString();
				}
			});
	});

	onDestroy(() => {
		removeEventListener('resize', disableSideways);
	});

	function onVideoSelected() {
		playerState.set(undefined);
	}
</script>

<div class:sideways-root={sideways} class:use-flex-column={!sideways} tabindex="0" role="button">
	<div id="thumbnail-container">
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a
			tabindex="-1"
			class="wave thumbnail"
			href={watchUrl.toString()}
			data-sveltekit-preload-data="off"
			onclick={onVideoSelected}
		>
			<div class="thumbnail-image">
				<div class:crop={thumbnailHeight > 300}>
					<img
						class="responsive"
						class:watched={progress !== undefined}
						{...thumbnail.image}
						bind:this={thumbnailHTMLElement}
						alt="Thumbnail for video"
					/>
				</div>
				<div
					{...thumbnail.fallback}
					class="secondary-container responsive"
					style="height: 200px;"
				></div>

				{#if progress !== undefined}
					<div class="chip surface-container-highest">
						<i>check</i>
					</div>
				{/if}
			</div>
			{#if progress}
				<progress
					class="absolute right bottom"
					style="z-index: 1;"
					value={progress}
					max={video.lengthSeconds}
				></progress>
			{/if}
			{#if !('liveVideo' in video) || !video.liveVideo}
				{#if video.lengthSeconds !== 0}
					<div
						class="absolute right bottom small-margin black white-text small-text thumbnail-corner"
					>
						&nbsp;{videoLength(video.lengthSeconds)}&nbsp;
					</div>
				{/if}
			{:else if video.lengthSeconds !== 0}
				<div class="absolute right bottom small-margin red white-text small-text thumbnail-corner">
					{$_('thumbnail.live')}
				</div>
			{:else}
				<h3>{$_('thumbnail.live')}</h3>
			{/if}
		</a>
	</div>

	<div class="thumbnail-details video-title" style="flex: 1;">
		<div class="video-title use-flex-column">
			<a
				tabindex="-1"
				style="padding-left: 1px;"
				class="video-title"
				data-sveltekit-preload-data="off"
				href={watchUrl.toString()}
				onclick={onVideoSelected}
			>
				<span class="bold" style="width: 100%;">{letterCase(video.title.trimEnd())}</span>
			</a>

			<nav class="align-end">
				{#if !sideways && 'authorId' in video}
					<AuthorAvatar author={video.author} authorId={video.authorId} />
				{/if}
				<div>
					{#if 'authorId' in video && video.authorId}
						<a
							tabindex="-1"
							class:author={!sideways}
							href={resolve(`/channel/[authorId]`, { authorId: video.authorId })}
							data-sveltekit-preload-data="off"
							>{video.author}
						</a>
					{:else}
						<p>{video.author}</p>
					{/if}

					{#if 'promotedBy' in video && video.promotedBy === 'favourited'}
						<i>star</i>
					{/if}

					{#if !('publishedText' in video) && 'viewCountText' in video}
						•
						{video.viewCountText ?? cleanNumber(video.viewCount ?? 0)}
						{$_('views')}
					{/if}

					{#if 'published' in video}
						<div>
							{video.viewCountText ?? cleanNumber(video.viewCount ?? 0)}
							•
							{video.published && video.published !== 0
								? relativeTimestamp(video.published * 1000, false)
								: video.publishedText}
						</div>
					{/if}
				</div>
			</nav>
		</div>
	</div>
</div>

<style>
	.crop {
		position: relative;
		width: 100%;
		overflow: hidden;
	}

	.crop img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		clip-path: inset(10% 0 10% 0);
		display: block;
		transform: translateY(-15%);
		margin-bottom: -22%;
	}

	.use-flex-column {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.thumbnail {
		width: 100%;
		overflow: hidden;
		display: inline-block;
	}

	.thumbnail img {
		object-fit: contain;
	}

	.sideways-root {
		height: 112px;
		display: flex;
		align-items: flex-start;
	}

	.sideways-root .thumbnail {
		width: 200px;
		flex-shrink: 0;
	}

	.sideways-root .thumbnail-details {
		flex: 1;
		min-width: 0;
		padding-right: 0.5em;
	}

	.sideways-root .video-title {
		overflow: hidden;
	}

	.sideways-root .video-title span {
		display: block;
		white-space: normal;
		overflow: hidden;
		word-wrap: break-word;
		line-height: 1.2;
	}

	.video-title {
		word-wrap: break-word;
		overflow: hidden;
		border-radius: 0px;
	}

	.thumbnail-details {
		display: flex;
		align-items: start;
		justify-content: start;
		padding: 0 1em 1em 1em;
		line-height: 1.5;
	}

	.thumbnail-image {
		position: relative;
	}

	.thumbnail-image .chip {
		position: absolute;
		top: 8px;
		right: 8px;
	}

	.watched {
		filter: brightness(40%);
	}

	.align-end {
		flex: 1;
		align-items: end;
	}

	@media screen and (max-width: 1000px) {
		.align-end {
			align-items: center;
		}
	}

	@media screen and (max-width: 1499px) {
		.sideways-root .thumbnail {
			width: 100%;
			max-height: 100%;
		}

		.sideways-root .thumbnail-details {
			display: none;
		}
	}
</style>
