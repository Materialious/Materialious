<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		addPlaylistVideo,
		getComments,
		getPersonalPlaylists,
		removePlaylistVideo
	} from '$lib/api/index';
	import type { Comments, PlaylistPage } from '$lib/api/model';
	import Comment from '$lib/components/Comment.svelte';
	import Player from '$lib/components/Player.svelte';
	import ShareVideo from '$lib/components/ShareVideo.svelte';
	import Thumbnail from '$lib/components/Thumbnail.svelte';
	import Transcript from '$lib/components/Transcript.svelte';
	import { getBestThumbnail } from '$lib/images';
	import { letterCase } from '$lib/letterCasing';
	import { cleanNumber, humanizeSeconds, numberWithCommas } from '$lib/numbers';
	import type { PlayerEvents } from '$lib/player.js';
	import {
		authStore,
		interfaceAutoExpandChapters,
		interfaceAutoExpandComments,
		playerTheatreModeByDefaultStore,
		playlistCacheStore,
		playlistSettingsStore,
		syncPartyConnectionsStore,
		syncPartyPeerStore
	} from '$lib/store';
	import ui from 'beercss';
	import type { DataConnection } from 'peerjs';
	import { type Segment } from 'sponsorblock-api';
	import { onDestroy, onMount, tick } from 'svelte';
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import { loadEntirePlaylist } from '$lib/playlist.js';
	import Author from '$lib/components/Watch/Author.svelte';
	import Description from '$lib/components/Watch/Description.svelte';
	import { expandSummery } from '$lib/misc.js';
	import LikesDislikes from '$lib/components/Watch/LikesDislikes.svelte';

	let { data = $bindable() } = $props();

	let playerElement: HTMLMediaElement | undefined = $state();

	let comments: Comments | null = $state(null);
	data.streamed.comments?.then((streamedComments) => {
		comments = streamedComments;
	});

	let subscribed: boolean = $state(false);
	data.streamed.subscribed.then((isSubbed) => (subscribed = isSubbed));

	let personalPlaylists: PlaylistPage[] | null = $state(null);
	data.streamed.personalPlaylists?.then((streamPlaylists) => (personalPlaylists = streamPlaylists));

	let loopPlaylist: boolean = $state(false);
	let shufflePlaylist: boolean = $state(false);

	let theatreMode = $state(get(playerTheatreModeByDefaultStore));

	let segments: Segment[] = $state([]);

	let pauseTimerSeconds: number = $state(-1);

	let showTranscript = $state(false);

	let playerCurrentTime: number = $state(0);

	$effect(() => {
		if ($interfaceAutoExpandComments && comments) {
			expandSummery('comment-section');
		}
	});

	playlistSettingsStore.subscribe((playlistSetting) => {
		if (!data.playlistId) return;
		if (data.playlistId in playlistSetting) {
			loopPlaylist = playlistSetting[data.playlistId].loop;
			shufflePlaylist = playlistSetting[data.playlistId].shuffle;
		}
	});

	function playerSyncEvents(conn: DataConnection) {
		if (playerElement) {
			conn.send({
				events: [{ type: 'seek', time: playerElement.currentTime }]
			} as PlayerEvents);
		}

		if (data.playlistId) {
			conn.send({
				events: [
					{
						type: 'playlist',
						playlistId: data.playlistId
					}
				]
			} as PlayerEvents);
		}

		conn.on('data', (rawData) => {
			const events = rawData as PlayerEvents;

			events.events.forEach(async (event) => {
				if (!playerElement) return;

				if (event.type === 'pause') {
					playerElement.pause();
				} else if (event.type === 'play') {
					playerElement.play();
				} else if (event.type === 'seek' && event.time) {
					const timeDiff = playerElement.currentTime - event.time;

					if (timeDiff > 5 || timeDiff < -5) {
						playerElement.currentTime = event.time;
					}
				} else if (
					event.type === 'playlist' &&
					event.playlistId &&
					event.playlistId !== data.playlistId
				) {
					data.playlistId = event.playlistId;
					await loadEntirePlaylist(event.playlistId);
					goToCurrentPlaylistItem();
				}
			});
		});

		if (!playerElement) return;

		playerElement.addEventListener('error', () => {
			if (!playerElement) return;
			conn.send({
				events: [
					{
						type: 'seek',
						time: playerElement.currentTime
					},
					{
						type: 'play'
					}
				]
			} as PlayerEvents);
		});

		playerElement.addEventListener('pause', () => {
			conn.send({
				events: [
					{
						type: 'pause'
					}
				]
			} as PlayerEvents);
		});

		playerElement.addEventListener('playing', () => {
			if (!playerElement) return;
			conn.send({
				events: [
					{
						type: 'seek',
						time: playerElement.currentTime
					},
					{
						type: 'play'
					}
				]
			} as PlayerEvents);
		});

		playerElement.addEventListener('play', () => {
			if (!playerElement) return;
			conn.send({
				events: [
					{
						type: 'seek',
						time: playerElement.currentTime
					},
					{
						type: 'play'
					}
				]
			} as PlayerEvents);
		});

		playerElement.addEventListener('waiting', () => {
			conn.send({
				events: [
					{
						type: 'pause'
					}
				]
			} as PlayerEvents);
		});

		playerElement.addEventListener('seeked', () => {
			if (!playerElement) return;
			conn.send({
				events: [
					{
						type: 'seek',
						time: playerElement.currentTime
					}
				]
			} as PlayerEvents);
		});
	}

	syncPartyConnectionsStore.subscribe((connections) => {
		if (!connections || !playerElement) return;
		playerSyncEvents(connections[connections.length - 1]);
	});

	onMount(async () => {
		if (data.playlistId) {
			await goToCurrentPlaylistItem();
		}

		if ($interfaceAutoExpandChapters) {
			expandSummery('chapter-section');
		}

		if ($syncPartyConnectionsStore) {
			$syncPartyConnectionsStore.forEach((conn) => {
				playerSyncEvents(conn);
			});
		}

		if (playerElement) {
			playerElement.addEventListener('timeupdate', () => {
				if (!playerElement) return;
				playerCurrentTime = playerElement.currentTime;
			});
		}
	});

	onDestroy(() => {
		// Reset title when page left.
		document.title = 'Materialious';

		if (pauseTimeout) {
			clearTimeout(pauseTimeout);
		}
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

	async function toggleVideoToPlaylist(playlistId: string) {
		if (!personalPlaylists) return;

		const selectedPlaylist = personalPlaylists.filter((item) => {
			return item.playlistId === playlistId;
		});

		if (selectedPlaylist.length === 0) {
			return;
		}

		const videosToDelete = selectedPlaylist[0].videos.filter((item) => {
			return item.videoId === data.video.videoId;
		});

		if (videosToDelete.length > 0) {
			videosToDelete.forEach(async (toDelete) => {
				await removePlaylistVideo(playlistId, toDelete.indexId);
			});
		} else {
			await addPlaylistVideo(playlistId, data.video.videoId);
		}

		setTimeout(async () => (personalPlaylists = await getPersonalPlaylists()), 500);
	}

	async function loadMoreComments() {
		if (!comments) {
			return;
		}

		const loadedComments = await getComments(data.video.videoId, {
			continuation: comments?.continuation
		});

		comments.continuation = loadedComments.continuation;

		comments.comments = [...comments.comments, ...loadedComments.comments];
	}

	function toggleTheatreMode() {
		theatreMode = !theatreMode;
	}

	let pauseTimeout: NodeJS.Timeout | undefined = $state();
	function setPauseTimer() {
		if (pauseTimeout) {
			clearTimeout(pauseTimeout);
		}
		pauseTimeout = setTimeout(() => {
			playerElement?.pause();
			pauseTimerSeconds = 0;
			clearTimeout(pauseTimeout);
		}, pauseTimerSeconds * 1000);

		ui('#pause-timer');
	}
</script>

<svelte:head>
	<title>{data.video.title}</title>
</svelte:head>

<div class="grid">
	<div class={`s12 m12 l${theatreMode ? '12' : '9'}`}>
		<div style="display: flex;justify-content: center;">
			{#key data.video.videoId}
				<Player bind:playerElement bind:segments {data} isSyncing={$syncPartyPeerStore !== null} />
			{/key}
		</div>

		<h5>{letterCase(data.video.title)}</h5>

		<div class="grid no-padding">
			<div class="s12 m12 l5">
				<Author video={data.video} bind:subscribed />
			</div>
			<div class="s12 m12 l7 video-actions">
				<LikesDislikes video={data.video} returnYTDislikes={data.streamed.returnYTDislikes} />

				<div>
					<button onclick={toggleTheatreMode} class="m l" class:border={!theatreMode}>
						<i>width_wide</i>
						<div class="tooltip">{$_('player.theatreMode')}</div>
					</button>
					{#if data.video.lengthSeconds > 360 && !data.video.hlsUrl}
						<button
							onclick={() => {
								if (pauseTimerSeconds < 1) {
									pauseTimerSeconds = 300;
								}
								ui('#pause-timer');
							}}
							class:border={pauseTimerSeconds < 1}
						>
							<i>snooze</i>
							<div class="tooltip">{$_('player.pauseTimer')}</div>
						</button>
					{/if}
					<button
						onclick={() => ((showTranscript = !showTranscript), (theatreMode = false))}
						class:border={!showTranscript}
					>
						<i>description</i>
						<div class="tooltip">
							{$_('transcript')}
						</div>
					</button>
					<button class="border"
						><i>share</i>
						<div class="tooltip">
							{$_('player.share.title')}
						</div>
						<menu class="no-wrap mobile">
							<ShareVideo bind:currentTime={playerCurrentTime} video={data.video} />
						</menu></button
					>
					{#if personalPlaylists}
						<button class="border">
							<i>add</i>
							<div class="tooltip">{$_('player.addToPlaylist')}</div>
							<menu class="no-wrap mobile">
								{#each personalPlaylists as personalPlaylist}
									<li
										role="presentation"
										class="row"
										onclick={async () => {
											await toggleVideoToPlaylist(personalPlaylist.playlistId);
											(document.activeElement as HTMLElement)?.blur();
										}}
									>
										<nav>
											<span class="max">{personalPlaylist.title}</span>
											{#if personalPlaylist.videos.filter((item) => {
												return item.videoId === data.video.videoId;
											}).length > 0}
												<i>close</i>
											{:else}
												<i>add</i>
											{/if}
										</nav>
									</li>
								{/each}
							</menu>
						</button>
					{:else}
						<button disabled class="border no-margin">
							<i>add</i>
							<div class="tooltip">
								{#if $authStore}
									{$_('player.noPlaylists')}
								{:else}
									{$_('loginRequired')}
								{/if}
							</div>
						</button>
					{/if}
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
					<div class="chapter-list" id="chapters">
						<ul class="list">
							{#each data.content.timestamps as timestamp}
								<li
									role="presentation"
									onclick={() => {
										if (playerElement) playerElement.currentTime = timestamp.time;
									}}
								>
									<img
										class="round large"
										loading="lazy"
										src={getBestThumbnail(data.video.videoThumbnails) as string}
										alt="Thumbnail for current video"
									/>
									<div class="max" style="white-space: pre-line; overflow-wrap: break-word;">
										<p style="no-margin no-padding">{timestamp.title}</p>
										<span
											class:primary={playerCurrentTime >= timestamp.time &&
												(playerCurrentTime <= timestamp.endTime || timestamp.endTime === -1)}
											class="chip no-margin">{timestamp.timePretty}</span
										>
									</div>
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

					<div class="medium scroll">
						{#each comments.comments as comment}
							<Comment {comment} videoId={data.video.videoId}></Comment>
						{/each}
						{#if comments.continuation}
							<button onclick={loadMoreComments} class="margin">{$_('loadMore')}</button>
						{/if}
					</div>
				</details>
			</article>
		{/if}
	</div>
	{#if !theatreMode}
		<div class="s12 m12 l3">
			{#if showTranscript && playerElement}
				<Transcript video={data.video} bind:playerElement />
			{/if}
			{#if data.playlistId && data.playlistId in $playlistCacheStore}
				<article
					style="height: 85vh; position: relative;scrollbar-width: none;"
					id="playlist"
					class="scroll no-padding surface-container border"
				>
					<article class="no-elevate border" style="position: sticky; top: 0; z-index: 3;">
						<h6>{$playlistCacheStore[data.playlistId].info.title}</h6>
						<p>
							{cleanNumber($playlistCacheStore[data.playlistId].info.viewCount)}
							{$_('views')} • {$playlistCacheStore[data.playlistId].info.videoCount}
							{$_('videos')}
						</p>
						<p>
							<a href={resolve(`/channel/${$playlistCacheStore[data.playlistId].info.authorId}`)}
								>{$playlistCacheStore[data.playlistId].info.author}</a
							>
						</p>
						<nav>
							<button
								onclick={() => {
									loopPlaylist = !loopPlaylist;
									playlistSettingsStore.set({
										[data.playlistId as string]: { loop: loopPlaylist, shuffle: shufflePlaylist }
									});
								}}
								class="circle"
								class:fill={!loopPlaylist}
							>
								<i>loop</i>
								<div class="tooltip bottom">
									{$_('playlist.loopPlaylist')}
								</div>
							</button>
							<button
								onclick={() => {
									shufflePlaylist = !shufflePlaylist;
									playlistSettingsStore.set({
										[data.playlistId as string]: { loop: loopPlaylist, shuffle: shufflePlaylist }
									});
								}}
								class="circle"
								class:fill={!shufflePlaylist}
							>
								<i>shuffle</i>
								<div class="tooltip bottom">
									{$_('playlist.shuffleVideos')}
								</div>
							</button>
						</nav>

						<div class="space"></div>
						<div class="divider"></div>
					</article>

					<div class="space"></div>

					{#each $playlistCacheStore[data.playlistId].videos as playlistVideo}
						<article
							class="no-padding border"
							style="margin: .7em;"
							id={playlistVideo.videoId}
							class:primary-border={playlistVideo.videoId === data.video.videoId}
						>
							{#key playlistVideo.videoId}
								<Thumbnail
									video={playlistVideo}
									sideways={true}
									playlistId={data.playlistId || undefined}
								/>
							{/key}
						</article>
					{/each}
				</article>
			{:else if data.video.recommendedVideos}
				{#each data.video.recommendedVideos as recommendedVideo}
					<article class="no-padding border">
						{#key recommendedVideo.videoId}
							<Thumbnail video={recommendedVideo} sideways={true} />
						{/key}
					</article>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<dialog
	id="pause-timer"
	onclose={(event: Event) => {
		if (pauseTimerSeconds > 0) setPauseTimer();
		(event.target as HTMLDialogElement).close();
	}}
>
	<div>
		<h6>{$_('player.pauseVideoIn')} {humanizeSeconds(pauseTimerSeconds)}</h6>

		<nav class="group">
			<button onclick={() => (pauseTimerSeconds += 300)} class="left-round">+5 mins</button>
			<button onclick={() => (pauseTimerSeconds += 1800)} class="no-round">+30 mins</button>
			<button onclick={() => (pauseTimerSeconds += 3600)} class="no-round">+1 hr</button>
			<button onclick={() => (pauseTimerSeconds += 7200)} class="right-round">+2 hrs</button>
		</nav>

		<div class="space"></div>

		<nav class="wrap">
			<button
				onclick={() => {
					pauseTimerSeconds = 0;
					clearTimeout(pauseTimeout);
					ui('#pause-timer');
				}}
				class="secondary max"
			>
				<i>delete</i>
				<span>Clear</span>
			</button>
		</nav>
	</div>
</dialog>

<style>
	.chapter-list {
		max-height: 300px;
		overflow-y: scroll;
		overflow-x: hidden;
	}

	.video-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
	}

	.video-actions button:not(.left-round):not(.right-round) {
		margin: 0.3em;
	}

	@media screen and (max-width: 1000px) {
		.video-actions {
			align-items: flex-start;
			flex-direction: column;
		}

		.video-actions > div {
			margin-top: 1em;
		}

		nav.group {
			flex-direction: column;
		}

		nav.group button {
			border-radius: 0.5rem !important;
		}
	}

	@media screen and (max-width: 1646px) {
		.grid {
			padding: 0;
		}
	}
</style>
