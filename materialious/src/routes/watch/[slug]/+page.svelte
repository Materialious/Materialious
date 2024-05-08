<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		addPlaylistVideo,
		deleteUnsubscribe,
		getComments,
		getPersonalPlaylists,
		getPlaylist,
		postSubscribe,
		removePlaylistVideo
	} from '$lib/Api/index.js';
	import type { Comments, PlaylistPage, PlaylistPageVideo } from '$lib/Api/model.js';
	import Comment from '$lib/Comment.svelte';
	import Player from '$lib/Player.svelte';
	import ShareVideo from '$lib/ShareVideo.svelte';
	import Thumbnail from '$lib/Thumbnail.svelte';
	import { cleanNumber, getBestThumbnail, numberWithCommas, unsafeRandomItem } from '$lib/misc';
	import type { PlayerEvents } from '$lib/player';
	import type { DataConnection } from 'peerjs';
	import { onDestroy, onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import type { MediaPlayerElement } from 'vidstack/elements';
	import {
		activePageStore,
		authStore,
		miniPlayerSrcStore,
		playerAutoplayNextByDefaultStore,
		playerListenByDefaultStore,
		playerMiniPlayerStore,
		playerTheatreModeByDefaultStore,
		playlistSettingsStore,
		syncPartyConnectionsStore,
		syncPartyPeerStore
	} from '../../../store';

	export let data;

	let comments: Comments | null = null;
	data.streamed.comments?.then((streamedComments) => {
		comments = streamedComments;
	});

	let subscribed: boolean = false;
	data.streamed.subscribed.then((streamedIsSubbed) => {
		subscribed = streamedIsSubbed;
	});

	let personalPlaylists: PlaylistPage[] | null = null;
	data.streamed.personalPlaylists?.then((streamPlaylists) => (personalPlaylists = streamPlaylists));

	activePageStore.set(null);

	let playlistVideos: PlaylistPageVideo[] = [];
	let playlist: PlaylistPage | null = null;

	let loopPlaylist: boolean = false;
	let shufflePlaylist: boolean = false;

	let theatreMode = get(playerTheatreModeByDefaultStore);

	let audioMode = get(playerListenByDefaultStore);
	let seekTo: (time: number) => void;
	let player: MediaPlayerElement;

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

					if (timeDiff > 3 || timeDiff < -3) {
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
			player.addEventListener('end', () => {
				if (playlistVideos.length === 0) {
					if ($playerAutoplayNextByDefaultStore) {
						goto(`/watch/${data.video.recommendedVideos[0].videoId}`);
					}
					return;
				}

				goToCurrentPlaylistItem();

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

		goToCurrentPlaylistItem();
	});

	onDestroy(() => {
		// Reset title when page left.
		document.title = 'Materialious';

		if (
			get(playerMiniPlayerStore) &&
			!player.paused &&
			!data.video.hlsUrl &&
			data.video.formatStreams &&
			data.video.formatStreams.length > 0
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
		}
	}

	function goToCurrentPlaylistItem() {
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

		personalPlaylists = await getPersonalPlaylists();
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

	async function toggleTheatreMode() {
		theatreMode = !theatreMode;
	}
</script>

<svelte:head>
	<title>{data.video.title} | Materialious</title>
</svelte:head>

<div class="grid">
	<div class={`s12 m12 l${theatreMode ? '12' : '10'}`}>
		<div style="display: flex;justify-content: center;">
			{#key data.video.videoId}
				<div
					style="max-height: 80vh;max-width: calc(80vh * 16 / 9);overflow: hidden;position: relative;flex: 1;"
				>
					<Player
						{data}
						{audioMode}
						isSyncing={$syncPartyPeerStore !== null}
						bind:seekTo
						bind:player
					/>
				</div>
			{/key}
		</div>
		<h5>{data.video.title}</h5>

		<div class="grid no-padding">
			<div class="s12 m12 l5">
				<nav>
					<a href={`/channel/${data.video.authorId}`}>
						<nav>
							<img
								class="circle large"
								src={getBestThumbnail(data.video.authorThumbnails)}
								alt="Channel profile"
							/>
							<div>
								<p class="bold">{data.video.author}</p>
								<p>{data.video.subCountText}</p>
							</div>
						</nav>
					</a>
					{#if $authStore}
						<button
							on:click={toggleSubscribed}
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
					{/if}
				{/await}

				<div>
					<button on:click={() => (audioMode = !audioMode)} class:border={!audioMode}>
						<i>headphones</i>
						<div class="tooltip">{$_('player.audioOnly')}</div>
					</button>
					<button on:click={toggleTheatreMode} class="m l" class:border={!theatreMode}>
						<i>width_wide</i>
						<div class="tooltip">{$_('player.theatreMode')}</div>
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
					{#if data.downloadOptions.length > 0}
						<button class="border"
							><i>download</i>
							<div class="tooltip">{$_('player.download')}</div>
							<menu class="no-wrap">
								{#each data.downloadOptions as download}
									<a class="row" href={download.url} target="_blank" rel="noopener noreferrer"
										>{download.title}</a
									>
								{/each}
							</menu></button
						>
					{/if}
					{#if personalPlaylists}
						<button class="border">
							<i>add</i>
							<div class="tooltip">{$_('player.addToPlaylist')}</div>
							<menu class="no-wrap">
								{#each personalPlaylists as personalPlaylist}
									<a
										href="#add"
										on:click={async () => await toggleVideoToPlaylist(personalPlaylist.playlistId)}
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
			<details>
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
								<button on:click={() => seekTo(timestamp.time)} class="timestamps"
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
				<details open>
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
							<button on:click={loadMoreComments} class="margin">{$_('loadMore')}</button>
						{/if}
					</div>
				</details>
			</article>
		{:else}
			<h6>{$_('player.unableToLoadComments')}</h6>
		{/if}
	</div>
	{#if !theatreMode}
		<div class="s12 m12 l2">
			{#if !playlist}
				{#if data.video.recommendedVideos}
					{#each data.video.recommendedVideos as recommendedVideo}
						<article class="no-padding">
							{#key recommendedVideo.videoId}
								<Thumbnail video={recommendedVideo} />
							{/key}
						</article>
					{/each}
				{/if}
			{:else}
				<article style="height: 75vh; position: relative;" id="playlist" class="scroll no-padding">
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
								on:click={() => (
									(loopPlaylist = !loopPlaylist),
									playlistSettingsStore.set({
										[playlist.playlistId]: { loop: loopPlaylist, shuffle: shufflePlaylist }
									})
								)}
								class="circle"
								class:fill={!loopPlaylist}
							>
								<i>loop</i>
								<div class="tooltip bottom">
									{$_('playlist.loopPlaylist')}
								</div>
							</button>
							<button
								on:click={() => (
									(shufflePlaylist = !shufflePlaylist),
									playlistSettingsStore.set({
										[playlist.playlistId]: { loop: loopPlaylist, shuffle: shufflePlaylist }
									})
								)}
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
								<Thumbnail video={playlistVideo} playlistId={data.playlistId || undefined} />
							{/key}
						</article>
					{/each}
				</article>
			{/if}
		</div>
	{/if}
</div>

<style>
	:root {
		--plyr-color-main: var(--primary);
	}

	.grid {
		padding: 1em 10em;
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
