<script lang="ts">
	import { resolve } from '$app/paths';
	import { getComments } from '#lib/api/index';
	import type { Comments, PlaylistPage } from '#lib/api/model';
	import Thumbnail from '#lib/components/thumbnail/VideoThumbnail.svelte';
	import Transcript from '#lib/components/watch/Transcript.svelte';
	import { getBestThumbnail } from '#lib/images';
	import { letterCase } from '#lib/letterCasing';
	import { numberWithCommas } from '#lib/numbers';
	import {
		interfaceAutoExpandChapters,
		interfaceAutoExpandComments,
		personalPlaylistsCacheStore,
		playerLoadingStore,
		playerMiniplayerEnabled,
		playerPlaylistHistory,
		playerState,
		playerTheatreModeByDefaultStore,
		playerFitScreenByDefaultStore,
		playerTheatreModeIsActive,
		playerIsInWindowFullscreen,
		playlistCacheStore,
		type PlayerState,
		filterContentListStore,
		sleepTimerStore
	} from '#lib/store';
	import { onDestroy, tick, untrack } from 'svelte';
	import { Capacitor } from '@capacitor/core';
	import { Haptics } from '@capacitor/haptics';
	import { Motion } from '@capacitor/motion';
	import { _ } from '#lib/i18n/index';
	import { get } from 'svelte/store';
	import Author from '#lib/components/Author.svelte';
	import Description from '#lib/components/watch/Description.svelte';
	import LikesDislikes from '#lib/components/watch/LikesDislikes.svelte';
	import Comment from '#lib/components/watch/Comment.svelte';
	import { expandSummery } from '#lib/utils';
	import { humanizeSeconds, relativeTimestamp } from '#lib/time';
	import { addToast } from '#lib/components/Toast.svelte';
	import { getWatchPage } from '#lib/watch';
	import { page } from '$app/state';
	import Share from '#lib/components/Share.svelte';
	import Playlist from '#lib/components/watch/Playlist.svelte';
	import PlaylistManager from '#lib/components/PlaylistManager.svelte';
	import { isItemFiltered } from '#lib/filtering/index';
	import PageLoading from '#lib/components/PageLoading.svelte';
	import Download from '#lib/components/watch/Download.svelte';
	import SleepTimer from '#lib/components/watch/SleepTimer.svelte';
	import { sleepTimerShakeToReset, sleepTimerVibrateBeforeEnd } from '#lib/stores/player';
	import { getPlatform } from '#lib/platform.ts';

	let { data = $bindable() }: { data: any } = $props();

	let playerElement: HTMLMediaElement | undefined = $state();
	let loaded = $state(false);

	let comments: Comments | null = $state(null);
	let commentSort: 'top' | 'new' = $state('top');
	let returnYTDislikes: Promise<any> | null = $state(null);

	if (getPlatform() !== 'android')
		playerTheatreModeIsActive.set(get(playerTheatreModeByDefaultStore));
	else playerTheatreModeIsActive.set(false);

	const videoId = $derived(data.video?.videoId);
	$effect(() => {
		if (!videoId || Capacitor.getPlatform() === 'android') {
			return;
		}

		// Apply defaults once per video, without reacting to manual mode changes.
		untrack(() => {
			if (get(playerFitScreenByDefaultStore)) {
				playerIsInWindowFullscreen.set(true);
			}
		});
	});

	const showAndroidSleepTimerOptions = getPlatform() === 'android';
	const pauseTimerWarningMs = 10_000;
	const shakeAcceleration = 13; // m/s² without gravity
	const shakeWindowMs = 500;
	const shakeCooldownMs = 1_000;

	let pauseTimerDuration = 0;
	let pauseTimerRemaining: number = $state(0);
	let pauseTimerEndsAt = $state(0);
	let pauseTimerWarningVibrated = false;
	let pauseTimerInterval: ReturnType<typeof setInterval> | undefined;
	let pauseTimeout: ReturnType<typeof setTimeout> | undefined;
	let pauseTimerDialog: HTMLDialogElement | undefined = $state();

	const pauseTimerActive = $derived(pauseTimerEndsAt > 0);
	const canSetPauseTimer = $derived(
		Number.isFinite(data.video?.lengthSeconds) &&
			data.video.lengthSeconds > 0 &&
			!data.video.liveNow &&
			!data.video.premium &&
			!hasPremiere()
	);

	$effect(() => {
		const endsAt = pauseTimerEndsAt;
		if (!showAndroidSleepTimerOptions || !$sleepTimerVibrateBeforeEnd || !endsAt) return;

		const warningTimeout = setTimeout(
			() => {
				if (pauseTimerWarningVibrated || pauseTimerEndsAt !== endsAt || Date.now() >= endsAt)
					return;
				pauseTimerWarningVibrated = true;
				void Haptics.vibrate().catch((error) =>
					console.warn('Sleep timer vibration failed', error)
				);
			},
			Math.max(0, endsAt - Date.now() - pauseTimerWarningMs)
		);
		return () => clearTimeout(warningTimeout);
	});

	$effect(() => {
		if (!showAndroidSleepTimerOptions || !$sleepTimerShakeToReset || !pauseTimerActive) return;

		let disposed = false;
		let listener: Awaited<ReturnType<typeof Motion.addListener>> | undefined;
		let lastPeak: { x: number; y: number; z: number; at: number } | undefined;
		let lastReset = -Infinity;

		void Motion.addListener('accel', ({ acceleration }) => {
			if (disposed || !acceleration || Date.now() >= pauseTimerEndsAt) return;
			const { x, y, z } = acceleration;
			if (x == null || y == null || z == null || Math.hypot(x, y, z) < shakeAcceleration) return;

			const now = performance.now();
			if (now - lastReset < shakeCooldownMs) return;

			const previous = lastPeak;
			lastPeak = { x, y, z, at: now };
			// A shake has two strong movements in opposite directions.
			if (
				!previous ||
				now - previous.at > shakeWindowMs ||
				x * previous.x + y * previous.y + z * previous.z >= 0
			)
				return;

			lastPeak = undefined;
			lastReset = now;
			setPauseTimer(pauseTimerDuration);
		})
			.then((handle) => {
				if (disposed) return handle.remove();
				listener = handle;
			})
			.catch((error) => console.warn('Sleep timer motion listener unavailable', error));

		return () => {
			disposed = true;
			void listener?.remove();
		};
	});

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
				const { duration, remaining, warningVibrated } = $sleepTimerStore;
				setPauseTimer(duration, remaining, warningVibrated);
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

	let playerReady = $state(false);

	const playerStream = data.streamed.player;
	const pageStream = data.streamed.page;

	pageStream?.then((pageResult: any) => {
		data = pageResult;
		loaded = true;
		playerLoadingStore.set(true);

		data.streamed.comments?.then((streamedComments: Comments) => {
			comments = streamedComments;
		});

		if (hasPremiere()) {
			premiereTime = relativeTimestamp(data.video.premiereTimestamp as number);
			premiereUpdateInterval = setInterval(async () => {
				const refreshed = await getWatchPage(data.video.videoId, page.url);
				data.video = refreshed.video;
				data.content = refreshed.content;

				if (hasPremiere()) {
					premiereTime = relativeTimestamp(data.video.premiereTimestamp as number);
				} else {
					clearInterval(premiereUpdateInterval);
					if (playerReady) {
						playerState.set({ ...$playerState, data: { ...data } });
					}
				}
			}, 60000);
		}
	});

	playerStream
		?.then(async (playerResult: any) => {
			if (!data.video) {
				try {
					await pageStream;
				} catch {
					// Page failed to load, there is nothing to play.
				}
			}

			if (data.video && playerResult.playerData) {
				data.video.dashUrl = playerResult.playerData.dashUrl ?? data.video.dashUrl;
				data.video.adaptiveFormats = playerResult.playerData.adaptiveFormats;
				data.video.captions = playerResult.playerData.captions;
				data.video.hlsUrl = playerResult.playerData.hlsUrl ?? data.video.hlsUrl;
				data.video.ytjs = playerResult.playerData.ytjs;
			}

			if (playerResult.personalPlaylists) {
				playerResult.personalPlaylists
					.then((streamPlaylists: PlaylistPage[]) => {
						personalPlaylistsCacheStore.set(streamPlaylists);
					})
					.catch(() => {
						// Personal playlists are not required to play the video.
					});
			}

			returnYTDislikes = playerResult.returnYTDislikes;
			playerReady = true;

			if (
				data.video &&
				!hasPremiere() &&
				!data.video.premium &&
				(!$playerState || $playerState.data.video.videoId !== data.video.videoId)
			) {
				playerLoadingStore.set(false);
				playerState.set({
					data: data
				});
			} else {
				playerLoadingStore.set(false);
			}

			if (data.video) {
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
			}
		})
		.catch(async (error: unknown) => {
			// A failed player-data request must not take down the page. Fall back to
			// the page data so the player can surface the playback failure itself.
			console.error('Failed to load player data:', error);

			if (!data.video) {
				try {
					await pageStream;
				} catch {
					// Page failed to load, there is nothing to play.
				}
			}

			playerLoadingStore.set(false);
			playerReady = true;

			if (
				data.video &&
				!hasPremiere() &&
				!data.video.premium &&
				(!$playerState || $playerState.data.video.videoId !== data.video.videoId)
			) {
				playerState.set({
					data: data
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

		if (data.playlistId) {
			const remaining = Math.ceil((pauseTimerEndsAt - Date.now()) / 1000);
			sleepTimerStore.set(
				remaining > 0
					? { duration: pauseTimerDuration, remaining, warningVibrated: pauseTimerWarningVibrated }
					: undefined
			);
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

		playerLoadingStore.set(false);
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

	function setPauseTimer(duration: number, remaining = duration, warningVibrated = false) {
		clearTimeout(pauseTimeout);
		clearInterval(pauseTimerInterval);
		pauseTimerDuration = duration;
		pauseTimerRemaining = Math.ceil(remaining);
		pauseTimerWarningVibrated = warningVibrated;
		pauseTimerEndsAt = Date.now() + remaining * 1000;

		pauseTimeout = setTimeout(() => {
			playerElement?.pause();
			addToast({ data: { text: $_('player.pauseTimerFinished'), icon: 'snooze' } });
			disablePauseTimer();
		}, remaining * 1000);

		pauseTimerInterval = setInterval(() => {
			pauseTimerRemaining = Math.max(0, Math.ceil((pauseTimerEndsAt - Date.now()) / 1000));
		}, 1000);
	}

	function addPauseTimer(seconds: number) {
		const remaining = Math.max(0, (pauseTimerEndsAt - Date.now()) / 1000);
		setPauseTimer(remaining > 0 ? pauseTimerDuration : seconds, remaining + seconds);
	}

	function disablePauseTimer() {
		clearPauseTimer();
		sleepTimerStore.set(undefined);
	}

	function clearPauseTimer() {
		clearTimeout(pauseTimeout);
		clearInterval(pauseTimerInterval);
		pauseTimerEndsAt = 0;
		pauseTimerDuration = 0;
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
		<div
			class={`s12 m12 l${$playerTheatreModeIsActive || $playerIsInWindowFullscreen ? '12' : '9'}`}
		>
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
						<button
							class="surface-container-highest"
							onclick={() =>
								window.open(
									`https://www.youtube.com/watch?v=${data.video.videoId}`,
									'_blank',
									'noopener,noreferrer'
								)}
						>
							<i>open_in_new</i>
							<div class="tooltip">{$_('player.watchOnYouTube')}</div>
						</button>
						<LikesDislikes video={data.video} {returnYTDislikes} />

						<button
							onclick={toggleTheatreMode}
							class="m l"
							class:surface-container-highest={!$playerTheatreModeIsActive}
						>
							<i>width_wide</i>
							<div class="tooltip">{$_('player.theatreMode')}</div>
						</button>
						{#if canSetPauseTimer || pauseTimerRemaining > 0}
							<button
								onclick={() => pauseTimerDialog?.showModal()}
								aria-label={$_('player.pauseTimer')}
								aria-haspopup="dialog"
								class:primary={pauseTimerRemaining > 0}
								class:surface-container-highest={pauseTimerRemaining === 0}
							>
								<i aria-hidden="true">snooze</i>
								{#if pauseTimerRemaining > 0}
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
									path: resolve('/(app)/watch/[slug]', { slug: data.video.videoId }),
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
							style="margin: 0;"
						/>
						<Download video={data.video} />

						<PlaylistManager mode="toggle" videoId={data.video.videoId} />
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
													path: `${resolve('/(app)/watch/[slug]', { slug: data.video.videoId })}?time=${Math.round(timestamp.time)}`
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
								<li
									role="presentation"
									data-ui="#comment-sort"
									onclick={() => reloadComments('top')}
								>
									{$_('commentSortTop')}
								</li>
								<li
									role="presentation"
									data-ui="#comment-sort"
									onclick={() => reloadComments('new')}
								>
									{$_('commentSortNewest')}
								</li>
							</menu>
						</button>

						<div class="comment-list">
							{#each comments.comments as comment (comment)}
								<Comment
									{comment}
									videoId={data.video.videoId}
									onTimestampClick={(time) => {
										if (playerElement) playerElement.currentTime = time;
									}}
								/>
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
					{#key data.video.videoId}
						<Transcript
							video={data.video}
							{playerElement}
							onSeek={(time) => {
								if (playerElement) playerElement.currentTime = time;
							}}
						/>
					{/key}
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

	{#if canSetPauseTimer || pauseTimerRemaining > 0}
		<SleepTimer
			bind:dialog={pauseTimerDialog}
			showAndroidOptions={showAndroidSleepTimerOptions}
			videoDuration={data.video.lengthSeconds}
			{pauseTimerRemaining}
			{addPauseTimer}
			{disablePauseTimer}
		/>
	{/if}
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
