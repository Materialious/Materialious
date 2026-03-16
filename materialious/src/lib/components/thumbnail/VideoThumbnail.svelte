<script lang="ts">
	import { resolve } from '$app/paths';
	import { getBestThumbnail } from '$lib/images';
	import { letterCase } from '$lib/letterCasing';
	import { cleanNumber, videoLength } from '$lib/numbers';
	import { onDestroy, onMount } from 'svelte';
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import { Avatar } from 'melt/builders';

	import {
		deArrowEnabledStore,
		filterContentListStore,
		filterContentUrlAutoUpdateStore,
		isAndroidTvStore,
		playerState
	} from '$lib/store';
	import { relativeTimestamp } from '$lib/time';
	import { queueGetWatchHistory } from '$lib/api/historyPool';
	import { getDeArrow, getThumbnailDeArrow } from '$lib/api/dearrow';
	import AuthorAvatar from '../AuthorAvatar.svelte';
	import Share from '../Share.svelte';
	import { deleteWatchHistoryItem, saveWatchHistory } from '$lib/api';
	import type { ThumbnailVideo } from '$lib/thumbnail';
	import { truncate } from '$lib/misc';

	interface Props {
		video: ThumbnailVideo;
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
	let thumbnailImageElement: HTMLImageElement | undefined = $state();
	let thumbnailElement: HTMLElement | undefined = $state();

	const thumbnail = new Avatar({
		src: () => thumbnailSrc,
		onLoadingStatusChange: () => {
			if (thumbnailImageElement) thumbnailHeight = thumbnailImageElement.naturalHeight;
		}
	});

	let startedSideways = sideways === true;
	function disableSideways() {
		if (!startedSideways) return;

		if (window.innerWidth <= 1800) {
			sideways = false;
		} else sideways = true;
	}

	let thumbnailActionsVisible = $state(false);

	const observer = new IntersectionObserver(([entry]) => {
		if (!entry.isIntersecting) thumbnailActionsVisible = false;
	});

	onMount(async () => {
		// Check if sideways should be enabled or disabled.
		disableSideways();

		addEventListener('resize', disableSideways);

		queueGetWatchHistory(video.videoId).then(async (watchHistory) => {
			if (watchHistory) {
				progress = watchHistory.progress.toString();
			}
		});

		if (thumbnailElement) observer.observe(thumbnailElement);
	});

	onDestroy(() => {
		removeEventListener('resize', disableSideways);
		observer.disconnect();
	});

	function onVideoSelected() {
		playerState.set(undefined);
	}
</script>

<div
	class:sideways-root={sideways}
	class:use-flex-column={!sideways}
	bind:this={thumbnailElement}
	tabindex="0"
	role="button"
	onmouseleave={() => (thumbnailActionsVisible = false)}
>
	{#if thumbnailActionsVisible}
		<menu class="active root-menu" onmouseleave={() => (thumbnailActionsVisible = false)}>
			<li>
				<Share
					shares={[
						{
							type: 'materialious',
							path: resolve('/watch/[videoId]', { videoId: video.videoId })
						},
						{
							type: 'invidious',
							path: `/watch?v=${video.videoId}`
						},
						{
							type: 'invidious redirect',
							path: `/watch?v=${video.videoId}`
						},
						{
							type: 'youtube',
							path: `/watch?v=${video.videoId}`
						}
					]}
					classes="transparent max"
					menuClasses="max no-wrap"
					iconOnly={false}
					onShare={() => (thumbnailActionsVisible = false)}
				/>
			</li>
			<li>
				<button
					onclick={async () => {
						if (progress) {
							await deleteWatchHistoryItem(video.videoId);
							progress = undefined;
						} else {
							await saveWatchHistory(video, 1);
							progress = '0';
						}

						thumbnailActionsVisible = false;
					}}
					class="transparent max"
				>
					{#if progress}
						<i>visibility_off</i>
						<span>{$_('markAs.unwatched')}</span>
					{:else}
						<i>visibility</i>
						<span>{$_('markAs.watched')}</span>
					{/if}
				</button>
			</li>
			<li>
				<button class="transparent max">
					<i>disabled_visible</i>
					<span>
						{$_('layout.filter.addFilter')}
					</span>
					<menu class="max" data-ui="#hide-menu" id="hide-menu">
						{#if 'authorId' in video}
							<li
								onclick={() => {
									$filterContentListStore?.push({
										type: 'video',
										conditions: [
											{
												field: 'authorId',
												operator: 'equals',
												values: [video.authorId],
												note: $_('layout.filter.channelFiltered', { authorName: video.author })
											}
										]
									});
									filterContentListStore.set($filterContentListStore);
									filterContentUrlAutoUpdateStore.set(false);
									thumbnailActionsVisible = false;
								}}
								role="presentation"
								data-ui="#hide-menu"
								class="row"
							>
								{$_('hideAuthor')}
							</li>
						{/if}
						<li
							onclick={() => {
								$filterContentListStore?.push({
									type: 'video',
									conditions: [
										{
											field: 'videoId',
											operator: 'equals',
											values: [video.videoId],
											note: $_('layout.filter.videoFiltered', {
												videoTitle: video.title,
												authorName: video.author
											})
										}
									]
								});
								filterContentListStore.set($filterContentListStore);
								filterContentUrlAutoUpdateStore.set(false);
								thumbnailActionsVisible = false;
							}}
							role="presentation"
							data-ui="#hide-menu"
							class="row"
						>
							{$_('hideVideo')}
						</li>
					</menu>
				</button>
			</li>
		</menu>
	{/if}
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
						class:watched={progress}
						{...thumbnail.image}
						bind:this={thumbnailImageElement}
						alt="Thumbnail for video"
					/>
				</div>
				<div
					{...thumbnail.fallback}
					class="secondary-container responsive"
					style="height: 200px;"
				></div>

				{#if progress}
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
				{#if !sideways}
					<AuthorAvatar
						author={video.author}
						authorId={'authorId' in video ? video.authorId : ''}
					/>
				{/if}
				<div class="author-details" class:not-sideways={!sideways}>
					<nav style="justify-content: space-between;width: 100%;">
						<div>
							{#if 'authorId' in video && video.authorId}
								<a
									tabindex="-1"
									class:author={!sideways}
									href={resolve(`/channel/[authorId]`, { authorId: video.authorId })}
									data-sveltekit-preload-data="off"
									>{truncate(video.author, 20)}
								</a>
							{:else}
								<p>{truncate(video.author, 20)}</p>
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
								<span>
									{video.viewCountText ?? cleanNumber(video.viewCount ?? 0)}
									•
									{video.published && video.published !== 0
										? relativeTimestamp(video.published * 1000, false)
										: video.publishedText}
								</span>
							{/if}
						</div>
						{#if !sideways}
							<button
								onclick={() => (thumbnailActionsVisible = !thumbnailActionsVisible)}
								class="transparent circle"
							>
								<i>more_vert</i>
							</button>
						{/if}
					</nav>
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

	.author-details span,
	.author-details p,
	.author-details a {
		white-space: normal;
		word-wrap: break-word;
		line-height: 1.2;
		font-size: clamp(0.65rem, 2.5cqw + 0.33rem, 1.15rem);
	}

	.author-details.not-sideways a,
	.author-details.not-sideways p,
	.author-details.not-sideways span {
		display: block;
	}

	.author-details {
		flex: 1;
		min-width: 0;
	}

	.video-title {
		word-wrap: break-word;
		overflow: hidden;
		border-radius: 0px;
		width: 100%;
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

	.root-menu > li:hover {
		background-color: transparent;
	}

	.sideways-root,
	.thumbnail-details {
		container-type: inline-size;
	}

	@media screen and (max-width: 1800px) {
		.sideways-root .thumbnail {
			width: 100%;
			max-height: 100%;
		}

		.align-end {
			align-items: center;
		}

		.sideways-root .thumbnail-details {
			display: none;
		}
	}
</style>
