<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		getComments
	} from '$lib/api/index';
	import type { Comments, PlaylistPage } from '$lib/api/model';
	import Thumbnail from '$lib/components/thumbnail/VideoThumbnail.svelte';
	import Transcript from '$lib/components/watch/Transcript.svelte';
	import { getBestThumbnail } from '$lib/images';
	import { letterCase } from '$lib/letterCasing';
	import { numberWithCommas } from '$lib/numbers';
	import {
		interfaceAutoExpandChapters,
		interfaceAutoExpandComments,
		personalPlaylistsCacheStore,
		playerMiniplayerEnabled,
		playerPlaylistHistory,
		playerState,
		playerTheatreModeByDefaultStore,
		playerTheatreModeIsActive,
		playerIsInWindowFullscreen,
		playlistCacheStore,
		type PlayerState,
		filterContentListStore,
		sleepTimerStore
	} from '$lib/store';
	import ui from 'beercss';
	import { onDestroy, onMount, tick } from 'svelte';
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import Author from '$lib/components/Author.svelte';
	import Description from '$lib/components/watch/Description.svelte';
	import LikesDislikes from '$lib/components/watch/LikesDislikes.svelte';
	import Comment from '$lib/components/watch/Comment.svelte';
	import { expandSummery } from '$lib/misc';
	import { humanizeSeconds, relativeTimestamp } from '$lib/time';
	import { addToast } from '$lib/components/Toast.svelte';
	import { getWatchDetails } from '$lib/watch';
	import { page } from '$app/state';
	import Share from '$lib/components/Share.svelte';
	import Playlist from '$lib/components/watch/Playlist.svelte';
	import PlaylistManager from '$lib/components/PlaylistManager.svelte';
	import { isItemFiltered } from '$lib/filtering/index';
	import PageLoading from '$lib/components/PageLoading.svelte';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let { data = $bindable() }: { data: any } = $props();

	let playerElement: HTMLMediaElement | undefined = $state();
	let loaded = $state(false);

	let comments: Comments | null = $state(null);
	let commentSort: 'top' | 'new' = $state('top');

	playerTheatreModeIsActive.set(get(playerTheatreModeByDefaultStore));

	let pauseTimerSeconds: number = $state(0);
	let pauseTimerRemaining: number = $state(0);
	let pauseTimerInterval: ReturnType<typeof setTimeout> | undefined;

	let showTranscript = $state(false);

	let playerCurrentTime: number = $state(0);

	function hasPremiere() {
		return (
			data.video?.premiereTimestamp &&
			data.video.premiereTimestamp !== 0 &&
			data.video.premiereTimestamp > Date.now()
		);
	}

	let premiereTime = $state('');
	let premiereUpdateInterval: ReturnType<typeof setTimeout>;

	async function load(state: PlayerState) {
		playerElement = state.playerElement;

		if (data.playlistId) {
			await goToCurrentPlaylistItem();
			playerPlaylistHistory.set([data.video.videoId, ...$playerPlaylistHistory]);

			if ($sleepTimerStore && $sleepTimerStore.remaining > 0) {
				pauseTimerSeconds = $sleepTimerStore.duration;
				pauseTimerRemaining = $sleepTimerStore.remaining;
				setPauseTimer();
			}
		} else {
			sleepTimerStore.set(undefined);
		}

		if ($interfaceAutoExpandChapters) {
			expandSummery('chapter-section');
		}

		if (playerElement) {
			playerElement.addEventListener('timeupdate', () => {
				if (!playerElement) return;
				playerCurrentTime = playerElement.currentTime;
			});
		}
	}

	data.streamed.details?.then((result: any) => {
		data = result;
		loaded = true;

		data.streamed.comments?.then((streamedComments: Comments) => {
			comments = streamedComments;
		});

		data.streamed.personalPlaylists?.then((streamPlaylists: PlaylistPage[]) => {
			personalPlaylistsCacheStore.set(streamPlaylists);
		});

		if (!hasPremiere() && !data.video.premium && (!$playerState || $playerState.data.video.videoId !== data.video.videoId)) {
			playerState.set({
				data: data
			});
		}

		if (hasPremiere()) {
			premiereTime = relativeTimestamp(data.video.premiereTimestamp as number);
			premiereUpdateInterval = setInterval(async () => {
				data = await getWatchDetails(data.video.videoId, page.url);

				if (hasPremiere()) {
					premiereTime = relativeTimestamp(data.video.premiereTimestamp as number);
				} else {
					clearInterval(premiereUpdateInterval);
					playerState.set({ ...$playerState, data: { ...data } });
				}
			}, 60000);
		}

		if ($playerState?.playerElement) {
			load($playerState);
		} else {
			let loadedPlayer = false;
			playerState.subscribe(async (updatedPlayerState) => {
				if (!updatedPlayerState?.playerElement || loadedPlayer) {
					return;
				}
				loadedPlayer = true;

				await load(updatedPlayerState);
			});
		}
	});

	$effect(() => {
		if ($interfaceAutoExpandComments && comments) {
			expandSummery('comment-section');
		}
	});

	onDestroy(() => {
		// Reset title when page left.
		document.title = 'Materialious';

		if (data.playlistId && pauseTimerSeconds > 0) {
			sleepTimerStore.set({ duration: pauseTimerSeconds, remaining: pauseTimerRemaining });
		}

		clearPauseTimer();

		if (premiereUpdateInterval) {
			clearInterval(premiereUpdateInterval);
		}

		if (
			!playerElement ||
			playerElement.paused ||
			playerElement.ended ||
			playerElement.currentTime === 0 ||
			playerElement.readyState <= 2 ||
			!$playerMiniplayerEnabled
		) {
			playerState.set(undefined);
		}

		playerTheatreModeIsActive.set(false);
	});

	async function goToCurrentPlaylistItem() {
		await tick();
		const playlistCurrentVideo = document.getElementById(data.video.videoId);
		const playlistScrollable = document.getElementById('playlist');

		if (playlistCurrentVideo && playlistScrollable) {
			playlistScrollable.scrollTop =
				playlistCurrentVideo.offsetTop - playlistScrollable.offsetTop - 200;
		}
	}

	async function loadMoreComments() {
		if (!comments) {
			return;
		}

		let loadedComments: Comments;

		try {
			if (comments.getContinuation) {
				loadedComments = await comments.getContinuation();
			} else if (comments.continuation) {
				loadedComments = await getComments(data.video.videoId, {
					continuation: comments.continuation,
					sort_by: commentSort
				});
			} else {
				return;
			}

			if (loadedComments.comments.length > 0) {
				comments.continuation = loadedComments.continuation;
				comments.comments = [...comments.comments, ...loadedComments.comments];
			}
		} catch (error) {
			console.error('Error loading more comments:', error);
		}
	}

	async function reloadComments(sort: 'top' | 'new') {
		commentSort = sort;
		try {
			const newComments = await getComments(data.video.videoId, { sort_by: sort });
			comments = newComments;
		} catch {
			// Continue regardless of error
		}
	}

	function toggleTheatreMode() {
		playerTheatreModeIsActive.set(!$playerTheatreModeIsActive);
	}

	let pauseTimeout: ReturnType<typeof setTimeout> | undefined = $state();
	function setPauseTimer() {
		if (pauseTimeout) clearTimeout(pauseTimeout);
		if (pauseTimerInterval) clearInterval(pauseTimerInterval);

		if (pauseTimerRemaining > 0) {
			pauseTimeout = setTimeout(() => {
				playerElement?.pause();
				addToast({ data: { text: $_('player.pauseTimerFinished'), icon: 'snooze' } });
				pauseTimerSeconds = 0;
				pauseTimerRemaining = 0;
				if (pauseTimerInterval) clearInterval(pauseTimerInterval);
				sleepTimerStore.set(undefined);
			}, pauseTimerRemaining * 1000);

			pauseTimerInterval = setInterval(() => {
				pauseTimerRemaining = Math.max(0, pauseTimerRemaining - 1);
			}, 1000);
		}
	}

	function clearPauseTimer() {
		if (pauseTimeout) clearTimeout(pauseTimeout);
		if (pauseTimerInterval) clearInterval(pauseTimerInterval);
		pauseTimerSeconds = 0;
		pauseTimerRemaining = 0;
	}
</script>

<svelte:head>
	{#if loaded}
		<title>{data.video.title}</title>
	{/if}
</svelte:head>

{#if !loaded}
	<PageLoading />
{:else}
<div class="grid no-padding">
	<div class={`s12 m12 l${$playerTheatreModeIsActive || $playerIsInWindowFullscreen ? '12' : '9'}`}>
		<div style="display: flex;justify-content: center;">
			{#if data.video.premium}
				<article class="video-placeholder">
					<p>{$_('premium')}</p>
				</article>
				<div class="space"></div>
			{:else if hasPremiere()}
				<article class="video-placeholder">
					<p>{$_('player.premiere')}</p>
					<h6 class="no-margin no-padding">
						{premiereTime}
					</h6>
				</article>
				<div class="space"></div>
			{/if}
		</div>

		<h5 class="no-margin">{letterCase(data.video.title)}</h5>

		<div class="grid no-padding">
			<div class="s12 m12 l7" style="height: 100%;display: flex;align-items: center;">
				<Author channel={data.video} />
			</div>
			<div class="s12 m12 l5 video-actions">
				<div>
					<LikesDislikes video={data.video} returnYTDislikes={data.streamed.returnYTDislikes} />

					<button
						onclick={toggleTheatreMode}
						class="m l"
						class:surface-container-highest={!$playerTheatreModeIsActive}
					>
						<i>width_wide</i>
						<div class="tooltip">{$_('player.theatreMode')}</div>
					</button>
					{#if data.video.lengthSeconds > 360 && !data.video.hlsUrl}
						<button
							onclick={() => ui('#pause-timer')}
							class:primary={pauseTimerSeconds > 0}
							class:surface-container-highest={pauseTimerSeconds === 0}
						>
							<i>snooze</i>
							{#if pauseTimerSeconds > 0}
								<span class="small-text">{humanizeSeconds(pauseTimerRemaining)}</span>
							{/if}
							<div class="tooltip">{$_('player.pauseTimer')}</div>
						</button>
					{/if}
					<button
						onclick={() => (
							(showTranscript = !showTranscript),
							playerTheatreModeIsActive.set(false)
						)}
						class:surface-container-highest={!showTranscript}
					>
						<i>description</i>
						<div class="tooltip">
							{$_('transcript')}
						</div>
					</button>
					<Share
						includePromptText={$_('player.share.includeTimestamp')}
						shares={[
							{
								type: 'materialious',
								path: resolve('/watch/[videoId]', { videoId: data.video.videoId }),
								param: {
									key: 'time',
									value: () => Math.round(playerCurrentTime)
								}
							},
							{
								type: 'invidious',
								path: `/watch?v=${data.video.videoId}`,
								param: {
									key: 't',
									value: () => Math.round(playerCurrentTime)
								}
							},
							{
								type: 'invidious redirect',
								path: `/watch?v=${data.video.videoId}`,
								param: {
									key: 't',
									value: () => Math.round(playerCurrentTime)
								}
							},
							{
								type: 'youtube',
								path: `/watch?v=${data.video.videoId}`,
								param: {
									key: 't',
									value: () => Math.round(playerCurrentTime)
								}
							}
						]}
						iconOnly={true}
						style="margin-left: 0;"
					/>
					<PlaylistManager
						mode="toggle"
						videoId={data.video.videoId}
					/>
				</div>
			</div>
		</div>

		<article class="border">
			<Description video={data.video} description={data.content.description} />
		</article>

		{#if data.content.timestamps.length > 0}
			<article class="border">
				<details>
					<summary id="chapter-section" class="bold none">
						<nav>
							<div class="max">
								<p>{$_('player.chapters')}</p>
							</div>
						</nav>
					</summary>
					<div class="space"></div>
					<div class="chapter-list" id="chapters">
						<ul class="list">
							{#each data.content.timestamps as timestamp (timestamp)}
								<li>
									<img
										class="round large"
										loading="lazy"
										src={getBestThumbnail(data.video.videoThumbnails) as string}
										alt="Thumbnail for current video"
										role="presentation"
										onclick={() => {
											if (playerElement) playerElement.currentTime = timestamp.time;
										}}
									/>
									<div
										role="presentation"
										onclick={() => {
											if (playerElement) playerElement.currentTime = timestamp.time;
										}}
										class="max"
										style="white-space: pre-line; overflow-wrap: break-word;"
									>
										<p style="margin: 0;">{timestamp.title}</p>
										<span
											class:primary={playerCurrentTime >= timestamp.time &&
												(playerCurrentTime <= timestamp.endTime || timestamp.endTime === -1)}
											class="chip no-margin">{timestamp.timePretty}</span
										>
									</div>
									<Share
										shares={[
											{
												type: 'materialious',
												path: resolve(`/watch/[videoId]?time=${Math.round(timestamp.time)}`, {
													videoId: data.video.videoId
												})
											},
											{
												type: 'invidious',
												path: `/watch?v=${data.video.videoId}&t=${Math.round(timestamp.time)}`
											},
											{
												type: 'invidious redirect',
												path: `/watch?v=${data.video.videoId}&t=${Math.round(timestamp.time)}`
											},
											{
												type: 'youtube',
												path: `/watch?v=${data.video.videoId}&t=${Math.round(timestamp.time)}`
											}
										]}
										iconOnly={true}
									/>
								</li>
							{/each}
						</ul>
					</div>
				</details>
			</article>
		{/if}

		{#if comments && comments.comments.length > 0}
			<article class="border">
				<details>
					<summary id="comment-section" class="none bold">
						<nav>
							<div class="max">{numberWithCommas(comments.commentCount)} {$_('comments')}</div>
						</nav>
					</summary>

					<div class="space"></div>

					<button class="surface-container-highest small" style="margin-bottom: 12px;">
						<i>sort</i>
						<span
							>{$_('commentSortBy')}: {commentSort === 'top'
								? $_('commentSortTop')
								: $_('commentSortNewest')}</span
						>
						<menu class="no-wrap" id="comment-sort" data-ui="#comment-sort">
							<li role="presentation" data-ui="#comment-sort" onclick={() => reloadComments('top')}>
								{$_('commentSortTop')}
							</li>
							<li role="presentation" data-ui="#comment-sort" onclick={() => reloadComments('new')}>
								{$_('commentSortNewest')}
							</li>
						</menu>
					</button>

					<div class="comment-list">
						{#each comments.comments as comment (comment)}
							<Comment {comment} videoId={data.video.videoId}></Comment>
						{/each}
						{#if comments.continuation}
							<div class="space"></div>
							<button onclick={loadMoreComments} class="secondary">
								<i>read_more</i>
								<span>{$_('loadMore')}</span>
							</button>
						{/if}
					</div>
				</details>
			</article>
		{/if}
	</div>
	{#if !$playerTheatreModeIsActive && !$playerIsInWindowFullscreen}
		<div class="s12 m12 l3 recommended">
			{#if showTranscript}
				<Transcript video={data.video} bind:currentTime={playerCurrentTime} />
			{/if}
			{#if data.playlistId && data.playlistId in $playlistCacheStore}
				<Playlist video={data.video} playlist={$playlistCacheStore[data.playlistId]} />
			{:else if data.video.recommendedVideos}
				{#key $filterContentListStore?.length}
					{#each data.video.recommendedVideos as recommendedVideo (recommendedVideo.videoId)}
						{#if !isItemFiltered(recommendedVideo)}
							<article class="no-padding border">
								{#key recommendedVideo.videoId}
									<Thumbnail video={recommendedVideo} sideways={true} />
								{/key}
							</article>
						{/if}
					{/each}
				{/key}
			{/if}
		</div>
	{/if}
</div>

<dialog id="pause-timer">
	<div>
		<nav class="no-space">
			<h6 class="max">
				{#if pauseTimerSeconds > 0}
					{$_('player.pauseVideoIn')} {humanizeSeconds(pauseTimerRemaining)}
				{:else}
					{$_('player.pauseTimer')}
				{/if}
			</h6>
			<button onclick={() => ui('#pause-timer')} class="circle transparent">
				<i>close</i>
			</button>
		</nav>

		<div class="space"></div>

		<div class="grid" style="gap: 0.5em;">
			<div class="s4 m4 l4">
				<button
					onclick={() => {
						pauseTimerSeconds = 300;
						pauseTimerRemaining = pauseTimerSeconds;
						setPauseTimer();
						ui('#pause-timer');
					}}
					class:primary={pauseTimerSeconds === 300}
					class="max"
					style="width: 100%; padding: 0.75em 0;">5 min</button
				>
			</div>
			<div class="s4 m4 l4">
				<button
					onclick={() => {
						pauseTimerSeconds = 600;
						pauseTimerRemaining = pauseTimerSeconds;
						setPauseTimer();
						ui('#pause-timer');
					}}
					class:primary={pauseTimerSeconds === 600}
					class="max"
					style="width: 100%; padding: 0.75em 0;">10 min</button
				>
			</div>
			<div class="s4 m4 l4">
				<button
					onclick={() => {
						pauseTimerSeconds = 1800;
						pauseTimerRemaining = pauseTimerSeconds;
						setPauseTimer();
						ui('#pause-timer');
					}}
					class:primary={pauseTimerSeconds === 1800}
					class="max"
					style="width: 100%; padding: 0.75em 0;">30 min</button
				>
			</div>
			<div class="s4 m4 l4">
				<button
					onclick={() => {
						pauseTimerSeconds = 3600;
						pauseTimerRemaining = pauseTimerSeconds;
						setPauseTimer();
						ui('#pause-timer');
					}}
					class:primary={pauseTimerSeconds === 3600}
					class="max"
					style="width: 100%; padding: 0.75em 0;">1 hr</button
				>
			</div>
			<div class="s4 m4 l4">
				<button
					onclick={() => {
						pauseTimerSeconds = 7200;
						pauseTimerRemaining = pauseTimerSeconds;
						setPauseTimer();
						ui('#pause-timer');
					}}
					class:primary={pauseTimerSeconds === 7200}
					class="max"
					style="width: 100%; padding: 0.75em 0;">2 hr</button
				>
			</div>
			<div class="s4 m4 l4">
				<button
					onclick={() => {
						clearPauseTimer();
						sleepTimerStore.set(undefined);
						ui('#pause-timer');
					}}
					class="max"
					style="width: 100%; padding: 0.75em 0;"
				>
					<i>delete</i>
				</button>
			</div>
		</div>
	</div>
</dialog>
{/if}

<style>
	.chapter-list,
	.comment-list {
		overflow-y: scroll;
		overflow-x: hidden;
	}

	.chapter-list {
		max-height: 300px;
	}

	.comment-list {
		max-height: 600px;
	}

	.recommended {
		margin-top: calc(var(--video-player-height) * -1);
	}

	.video-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
	}

	.video-placeholder {
		height: 50vh;
	}

	.video-actions button {
		margin-left: 0;
	}

	@media screen and (max-width: 1200px) {
		.video-actions {
			align-items: flex-start;
			flex-direction: column;
		}
	}

	@media only screen and (max-width: 993px) {
		.recommended {
			margin-top: 0;
		}
	}
</style>
