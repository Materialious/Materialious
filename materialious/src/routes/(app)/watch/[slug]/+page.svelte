<script lang="ts">
	import { run } from 'svelte/legacy';

	import { goto } from '$app/navigation';
	import {
		addPlaylistVideo,
		deleteUnsubscribe,
		getComments,
		getPersonalPlaylists,
		getPlaylist,
		postSubscribe,
		removePlaylistVideo
	} from '$lib/api/index';
	import type { Comments, PlaylistPage, PlaylistPageVideo } from '$lib/api/model';
	import Comment from '$lib/components/Comment.svelte';
	import Player from '$lib/components/Player.svelte';
	import ShareVideo from '$lib/components/ShareVideo.svelte';
	import Thumbnail from '$lib/components/Thumbnail.svelte';
	import Transcript from '$lib/components/Transcript.svelte';
	import { getBestThumbnail, proxyGoogleImage } from '$lib/images';
	import { letterCase } from '$lib/letterCasing';
	import { truncate, unsafeRandomItem } from '$lib/misc';
	import type { PlayerEvents } from '$lib/player';
	import {
		activePageStore,
		authStore,
		interfaceAutoExpandComments,
		interfaceAutoExpandDesc,
		interfaceLowBandwidthMode,
		miniPlayerSrcStore,
		playerAutoplayNextByDefaultStore,
		playerListenByDefaultStore,
		playerMiniPlayerStore,
		playerTheatreModeByDefaultStore,
		playlistSettingsStore,
		syncPartyConnectionsStore,
		syncPartyPeerStore
	} from '$lib/store';
	import { cleanNumber, humanizeSeconds, numberWithCommas } from '$lib/time';
	import ui from 'beercss';
	import type { DataConnection } from 'peerjs';
	import { type Segment } from 'sponsorblock-api';
	import { onDestroy, onMount, tick } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import type { MediaTimeUpdateEvent } from 'vidstack';
	import type { MediaPlayerElement } from 'vidstack/elements';

	let { data = $bindable() } = $props();

	let comments: Comments | null = $state(null);
	data.streamed.comments?.then((streamedComments) => {
		comments = streamedComments;
	});

	let subscribed: boolean = $state(false);
	data.streamed.subscribed.then((streamedIsSubbed) => {
		subscribed = streamedIsSubbed;
	});

	let personalPlaylists: PlaylistPage[] | null = $state(null);
	data.streamed.personalPlaylists?.then((streamPlaylists) => (personalPlaylists = streamPlaylists));

	activePageStore.set(null);

	let playlistVideos: PlaylistPageVideo[] = $state([]);
	let playlist: PlaylistPage | null = $state(null);

	let loopPlaylist: boolean = $state(false);
	let shufflePlaylist: boolean = $state(false);

	let theatreMode = $state(get(playerTheatreModeByDefaultStore));

	let audioMode = $state(get(playerListenByDefaultStore));
	let player: MediaPlayerElement = $state();

	let segments: Segment[] = $state([]);

	let pauseTimerSeconds: number = $state(-1);

	let showTranscript = $state(false);

	let playerCurrentTime: number = $state(0);
	// @ts-ignore
	run(() => {
		if (typeof player !== 'undefined') {
			playerCurrentTime = player.currentTime;
			player.addEventListener(
				'time-update',
				(event: MediaTimeUpdateEvent) => (playerCurrentTime = event.detail.currentTime)
			);
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
		if (player) {
			conn.send({
				events: [{ type: 'seek', time: player.currentTime }]
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
				if (!player) return;

				if (event.type === 'pause') {
					player.pause();
				} else if (event.type === 'play') {
					player.play();
				} else if (event.type === 'seek' && event.time) {
					const timeDiff = player.currentTime - event.time;

					if (timeDiff > 5 || timeDiff < -5) {
						player.currentTime = event.time;
					}
				} else if (
					event.type === 'playlist' &&
					event.playlistId &&
					event.playlistId !== data.playlistId
				) {
					data.playlistId = event.playlistId;
					await loadPlaylist(event.playlistId);
					goToCurrentPlaylistItem();
				}
			});
		});

		if (!player) return;

		player.addEventListener('auto-play-fail', () => {
			conn.send({
				events: [
					{
						type: 'pause'
					}
				]
			} as PlayerEvents);
		});

		player.addEventListener('auto-play', () => {
			if (!player) return;
			conn.send({
				events: [
					{
						type: 'seek',
						time: player.currentTime
					},
					{
						type: 'play'
					}
				]
			} as PlayerEvents);
		});

		player.addEventListener('pause', () => {
			conn.send({
				events: [
					{
						type: 'pause'
					}
				]
			} as PlayerEvents);
		});

		player.addEventListener('playing', () => {
			if (!player) return;
			conn.send({
				events: [
					{
						type: 'seek',
						time: player.currentTime
					},
					{
						type: 'play'
					}
				]
			} as PlayerEvents);
		});

		player.addEventListener('play', () => {
			if (!player) return;
			conn.send({
				events: [
					{
						type: 'seek',
						time: player.currentTime
					},
					{
						type: 'play'
					}
				]
			} as PlayerEvents);
		});

		player.addEventListener('waiting', () => {
			conn.send({
				events: [
					{
						type: 'pause'
					}
				]
			} as PlayerEvents);
		});

		player.addEventListener('seeked', () => {
			if (!player) return;
			conn.send({
				events: [
					{
						type: 'seek',
						time: player.currentTime
					}
				]
			} as PlayerEvents);
		});
	}

	syncPartyConnectionsStore.subscribe((connections) => {
		if (!connections || !player) return;
		playerSyncEvents(connections[connections.length - 1]);
	});

	onMount(async () => {
		if ($syncPartyConnectionsStore) {
			$syncPartyConnectionsStore.forEach((conn) => {
				playerSyncEvents(conn);
			});
		}

		if (player) {
			player.addEventListener('end', async () => {
				if (playlistVideos.length === 0) {
					if ($playerAutoplayNextByDefaultStore) {
						goto(`/watch/${data.video.recommendedVideos[0].videoId}`);
					}
					return;
				}

				await goToCurrentPlaylistItem();

				const playlistVideoIds = playlistVideos.map((value) => {
					return value.videoId;
				});

				let goToVideo: PlaylistPageVideo | undefined;

				if (shufflePlaylist) {
					goToVideo = unsafeRandomItem(playlistVideos);
				} else {
					const currentVideoIndex = playlistVideoIds.indexOf(data.video.videoId);
					const newIndex = currentVideoIndex + 1;
					if (currentVideoIndex !== -1 && newIndex < playlistVideoIds.length) {
						goToVideo = playlistVideos[newIndex];
					} else if (loopPlaylist) {
						// Loop playlist on end
						goToVideo = playlistVideos[0];
					}
				}

				if (typeof goToVideo !== 'undefined') {
					if ($syncPartyConnectionsStore) {
						$syncPartyConnectionsStore.forEach((conn) => {
							if (typeof goToVideo === 'undefined') return;

							conn.send({
								events: [
									{ type: 'change-video', videoId: goToVideo.videoId },
									{ type: 'playlist', playlistId: data.playlistId }
								]
							} as PlayerEvents);
						});
					}

					goto(`/watch/${goToVideo.videoId}?playlist=${data.playlistId}`);
				}
			});
		}

		if (!data.playlistId) return;

		await loadPlaylist(data.playlistId);

		await goToCurrentPlaylistItem();
	});

	onDestroy(() => {
		// Reset title when page left.
		document.title = 'Materialious';

		if (pauseTimeout) {
			clearTimeout(pauseTimeout);
		}

		if (
			get(playerMiniPlayerStore) &&
			!player.paused &&
			!$syncPartyPeerStore &&
			!data.video.hlsUrl &&
			data.video.formatStreams &&
			data.video.formatStreams.length > 0 &&
			data.video.fallbackPatch === undefined
		) {
			miniPlayerSrcStore.set({
				video: data.video,
				time: player.currentTime
			});
		}
	});

	async function loadPlaylist(playlistId: string) {
		for (let page = 1; page < Infinity; page++) {
			const newPlaylist = await getPlaylist(playlistId, page);
			if (page === 1) {
				playlist = newPlaylist;
			}
			const newVideos = newPlaylist.videos;
			if (newVideos.length === 0) {
				break;
			}
			playlistVideos = [...playlistVideos, ...newVideos].sort(
				(a: PlaylistPageVideo, b: PlaylistPageVideo) => {
					return a.index < b.index ? -1 : 1;
				}
			);

			playlistVideos = playlistVideos.filter((playlistVideo) => {
				return playlistVideo.lengthSeconds > 0;
			});
		}
	}

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

	async function toggleSubscribed() {
		if (subscribed) {
			await deleteUnsubscribe(data.video.authorId);
		} else {
			await postSubscribe(data.video.authorId);
		}

		subscribed = !subscribed;
	}

	function toggleTheatreMode() {
		theatreMode = !theatreMode;
	}

	let pauseTimeout: NodeJS.Timeout = $state();
	function setPauseTimer() {
		if (pauseTimeout) {
			clearTimeout(pauseTimeout);
		}
		pauseTimeout = setTimeout(() => {
			player.pause();
			pauseTimerSeconds = 0;
			clearTimeout(pauseTimeout);
		}, pauseTimerSeconds * 1000);

		ui('#pause-timer');
	}

	let downloadStage: string | undefined;
	let downloadProgress: number = 0;
</script>

<svelte:head>
	<title>{data.video.title} | Materialious</title>
</svelte:head>

<div class="space"></div>

<div class="grid">
	<div class={`s12 m12 l${theatreMode ? '12' : '9'}`}>
		<div style="display: flex;justify-content: center;">
			{#key data.video.videoId}
				<div
					style="max-height: 80vh;max-width: calc(80vh * 16 / 9);overflow: hidden;position: relative;flex: 1;"
				>
					<Player
						bind:segments
						{data}
						{audioMode}
						isSyncing={$syncPartyPeerStore !== null}
						bind:player
					/>
				</div>
			{/key}
		</div>

		{#if downloadStage}
			<article>
				<h6>
					{downloadStage}
					{#if downloadProgress > 0}
						({Math.round(downloadProgress)}%)
					{/if}
				</h6>
				<progress class="max" value={downloadProgress} max="100"></progress>
			</article>
		{/if}

		<h5>{letterCase(data.video.title)}</h5>

		<div class="grid no-padding">
			<div class="s12 m12 l5">
				<nav>
					<a href={`/channel/${data.video.authorId}`}>
						<nav>
							{#if !$interfaceLowBandwidthMode}
								<img
									class="circle large"
									src={proxyGoogleImage(getBestThumbnail(data.video.authorThumbnails))}
									alt="Channel profile"
								/>
							{/if}
							<div>
								<p style="margin: 0;" class="bold">{truncate(data.video.author, 16)}</p>
								<p style="margin: 0;">{data.video.subCountText}</p>
							</div>
						</nav>
					</a>
					{#if $authStore}
						<button
							onclick={toggleSubscribed}
							class:inverse-surface={!subscribed}
							class:border={subscribed}
						>
							{#if !subscribed}
								{$_('subscribe')}
							{:else}
								{$_('unsubscribe')}
							{/if}
						</button>
					{:else}
						<button class="inverse-surface" disabled>
							{$_('subscribe')}
							<div class="tooltip">
								{$_('loginRequired')}
							</div>
						</button>
					{/if}
				</nav>
			</div>
			<div class="s12 m12 l7 video-actions">
				{#await data.streamed.returnYTDislikes then returnYTDislikes}
					{#if returnYTDislikes}
						<nav class="no-space" style="margin-right: .5em;">
							<button style="cursor: default;" class="border left-round">
								<i class="small">thumb_up</i>
								<span>{cleanNumber(returnYTDislikes.likes)}</span>
							</button>
							<button style="cursor: default;" class="border right-round">
								<i class="small">thumb_down_alt</i>
								<span>{cleanNumber(returnYTDislikes.dislikes)}</span>
							</button>
						</nav>
					{:else}
						<button style="cursor: default;" class="border">
							<i class="small">thumb_up</i>
							<span>{cleanNumber(data.video.likeCount)}</span>
						</button>
					{/if}
				{/await}

				<div>
					<button onclick={() => (audioMode = !audioMode)} class:border={!audioMode}>
						<i>headphones</i>
						<div class="tooltip">{$_('player.audioOnly')}</div>
					</button>
					<button onclick={toggleTheatreMode} class="m l" class:border={!theatreMode}>
						<i>width_wide</i>
						<div class="tooltip">{$_('player.theatreMode')}</div>
					</button>
					{#if data.video.lengthSeconds > 60 && !data.video.hlsUrl}
						<button
							onclick={() => {
								if (pauseTimeout) {
									clearTimeout(pauseTimeout);
								}
								pauseTimerSeconds = 0;
								ui('#pause-timer');
							}}
							class:border={pauseTimerSeconds < 1}
						>
							<i>schedule</i>
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
						<menu class="no-wrap">
							<ShareVideo video={data.video} />
						</menu></button
					>
					{#if personalPlaylists}
						<button class="border">
							<i>add</i>
							<div class="tooltip">{$_('player.addToPlaylist')}</div>
							<menu class="no-wrap">
								{#each personalPlaylists as personalPlaylist}
									<a
										href="#add"
										onclick={async () => await toggleVideoToPlaylist(personalPlaylist.playlistId)}
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
									</a>
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

		<article>
			<details open={$interfaceAutoExpandDesc}>
				<summary class="bold none">
					<nav>
						<div class="max">
							{numberWithCommas(data.video.viewCount)} views • {data.video.publishedText}
						</div>
						<i>expand_more</i>
					</nav>
				</summary>
				<div class="space"></div>
				<div class="medium scroll">
					<div style="white-space: pre-line; overflow-wrap: break-word;">
						{@html data.content.description}
					</div>
					{#if data.content}
						{#if data.content.timestamps.length > 0}
							<h6 style="margin-bottom: .3em;">Chapters</h6>
							{#each data.content.timestamps as timestamp}
								<button onclick={() => (player.currentTime = timestamp.time)} class="timestamps"
									>{timestamp.timePretty}
									{#if !timestamp.title.startsWith('-')}
										-
									{/if}
									{timestamp.title}</button
								>
							{/each}
						{/if}
					{/if}
				</div>

				<nav class="scroll">
					{#if data.video.keywords}
						{#each data.video.keywords as keyword}
							<a href={`/search/${encodeURIComponent(keyword)}`} class="chip">{keyword}</a>
						{/each}
					{/if}
				</nav>
			</details>
		</article>

		{#if comments && comments.comments.length > 0}
			<article>
				<details open={$interfaceAutoExpandComments}>
					<summary class="none bold">
						<nav>
							<div class="max">{numberWithCommas(comments.commentCount)} comments</div>
							<i>expand_more</i>
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
			{#if player && showTranscript}
				<Transcript bind:player video={data.video} />
			{/if}
			{#if playlist}
				<article
					style="height: 85vh; position: relative;"
					id="playlist"
					class="scroll no-padding surface-container-high"
				>
					<article class="no-elevate" style="position: sticky; top: 0; z-index: 3;">
						<h6>{playlist.title}</h6>
						<p>
							{cleanNumber(playlist.viewCount)}
							{$_('views')} • {playlist.videoCount}
							{$_('videos')}
						</p>
						<p><a href={`/channel/${playlist.authorId}`}>{playlist.author}</a></p>
						<nav>
							<button
								onclick={() => {
									if (!playlist) return;

									loopPlaylist = !loopPlaylist;
									playlistSettingsStore.set({
										[playlist.playlistId]: { loop: loopPlaylist, shuffle: shufflePlaylist }
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
									if (!playlist) return;

									shufflePlaylist = !shufflePlaylist;
									playlistSettingsStore.set({
										[playlist.playlistId]: { loop: loopPlaylist, shuffle: shufflePlaylist }
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

					{#each playlistVideos as playlistVideo}
						<article
							class="no-padding primary-border"
							style="margin: .7em;"
							id={playlistVideo.videoId}
							class:border={playlistVideo.videoId === data.video.videoId}
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
					<article class="no-padding">
						{#key recommendedVideo.videoId}
							<Thumbnail video={recommendedVideo} sideways={true} />
						{/key}
					</article>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<dialog class="modal" id="pause-timer">
	{#if player}
		<div class="field middle-align">
			<label class="slider">
				<input
					type="range"
					bind:value={pauseTimerSeconds}
					min="0"
					step="60"
					max={data.video.lengthSeconds - playerCurrentTime - 60}
				/>
				<span></span>
			</label>
			{#if pauseTimerSeconds > 0}
				<span class="helper">{$_('player.pauseVideoIn')} {humanizeSeconds(pauseTimerSeconds)}</span>
			{/if}
		</div>
	{/if}
	<nav class="right-align no-space">
		<button
			class="transparent link"
			onclick={() => {
				ui('#pause-timer');
				pauseTimerSeconds = 0;
			}}>Cancel</button
		>
		<button disabled={pauseTimerSeconds < 1} class="transparent link" onclick={setPauseTimer}
			>Confirm</button
		>
	</nav>
</dialog>

<style>
	:root {
		--plyr-color-main: var(--primary);
	}

	.timestamps {
		margin-left: 0;
		margin-bottom: 0.4em;
		display: block;
		padding: 0;
		text-align: left;
		background-color: transparent;
		color: var(--on-secondary-container);
	}

	.timestamps:hover {
		padding: 0 0.5em;
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
	}

	@media screen and (max-width: 1000px) {
		.video-actions > div {
			margin-top: 1em;
		}
	}

	@media screen and (max-width: 1000px) {
		menu {
			z-index: 9999;
			position: fixed;
			top: 30%;
			left: 50%;
			width: 100%;
			transform: translate(-50%, 50%);
			background-color: var(--surface-variant);
		}
	}

	@media screen and (max-width: 1646px) {
		.grid {
			padding: 0;
		}
	}
</style>
