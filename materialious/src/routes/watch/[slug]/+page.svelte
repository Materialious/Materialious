<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		addPlaylistVideo,
		deleteUnsubscribe,
		getComments,
		getPersonalPlaylists,
		getPlaylist,
		postSubscribe
	} from '$lib/Api/index.js';
	import type { PlaylistPage, PlaylistPageVideo } from '$lib/Api/model.js';
	import Comment from '$lib/Comment.svelte';
	import PageLoading from '$lib/PageLoading.svelte';
	import Player from '$lib/Player.svelte';
	import Thumbnail from '$lib/Thumbnail.svelte';
	import { cleanNumber, numberWithCommas } from '$lib/misc.js';
	import type { PlayerEvents } from '$lib/player';
	import type { DataConnection } from 'peerjs';
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import type { MediaPlayerElement } from 'vidstack/elements';
	import {
		activePage,
		auth,
		playerAutoplayNextByDefault,
		playerListenByDefault,
		playerTheatreModeByDefault,
		syncPartyConnections,
		syncPartyPeer
	} from '../../../store';

	export let data;

	$: comments = data.comments;

	activePage.set(null);

	let playlistVideos: PlaylistPageVideo[] = [];
	let playlist: PlaylistPage | null = null;

	let theatreMode = get(playerTheatreModeByDefault);

	let audioMode = get(playerListenByDefault);
	let currentTime: number;
	let seekTo: (time: number) => void;
	let player: MediaPlayerElement;

	function playerSyncEvents(conn: DataConnection) {
		conn.send({
			events: [{ type: 'seek', time: player.currentTime }]
		} as PlayerEvents);

		conn.on('data', (rawData) => {
			const events = rawData as PlayerEvents;

			if (!player) return;

			events.events.forEach(async (event) => {
				if (event.type === 'pause') {
					player.pause();
				} else if (event.type === 'play') {
					player.play();
				} else if (event.type === 'seek' && event.time) {
					const timeDiff = player.currentTime - event.time;

					if (timeDiff > 3 || timeDiff < -3) {
						player.currentTime = event.time;
					}
				}
			});
		});

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

	syncPartyConnections.subscribe((connections) => {
		if (!connections || !player) return;
		playerSyncEvents(connections[connections.length - 1]);
	});

	onMount(async () => {
		if ($syncPartyConnections) {
			$syncPartyConnections.forEach((conn) => {
				playerSyncEvents(conn);
			});
		}

		player.addEventListener('end', () => {
			if ($playerAutoplayNextByDefault && !playlist) {
				goto(`/watch/${data.video.recommendedVideos[0].videoId}`);
			}

			if (data.playlistId) {
				goToCurrentPlaylistItem();
			}
		});

		if (!data.playlistId) return;

		await loadPlaylist(data.playlistId);

		goToCurrentPlaylistItem();

		if (playlistVideos) {
			player.addEventListener('end', () => {
				if (!playlistVideos) return;

				const playlistVideoIds = playlistVideos.map((value) => {
					return value.videoId;
				});

				const currentVideoIndex = playlistVideoIds.indexOf(data.video.videoId);
				const newIndex = currentVideoIndex + 1;
				if (currentVideoIndex !== -1 && newIndex <= playlistVideoIds.length) {
					if ($syncPartyConnections) {
						$syncPartyConnections.forEach((conn) => {
							conn.send({
								events: [{ type: 'change-video', videoId: playlistVideos[newIndex].videoId }]
							} as PlayerEvents);
						});
					}
					goto(`/watch/${playlistVideos[newIndex].videoId}?playlist=${data.playlistId}`);
				}
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

	async function addVideoToPlaylist(playlistId: string) {
		await addPlaylistVideo(playlistId, data.video.videoId);

		data.personalPlaylists = await getPersonalPlaylists();
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
		if (data.subscribed) {
			await deleteUnsubscribe(data.video.authorId);
		} else {
			await postSubscribe(data.video.authorId);
		}

		data.subscribed = !data.subscribed;
	}

	async function toggleTheatreMode() {
		theatreMode = !theatreMode;
	}
</script>

{#if data}
	<div class="grid">
		<div class={`s12 m12 l${theatreMode ? '12' : '10'}`}>
			{#key data.video.videoId}
				<Player
					{data}
					{audioMode}
					isSyncing={$syncPartyPeer !== null}
					bind:seekTo
					bind:currentTime
					bind:player
				/>
			{/key}

			<h5>{data.video.title}</h5>

			<div class="grid no-padding">
				<div class="s12 m12 l5">
					<nav>
						<a href={`/channel/${data.video.authorId}`}>
							<nav>
								<img
									class="circle large"
									src={data.video.authorThumbnails[2].url}
									alt="Channel profile"
								/>
								<div>
									<p class="bold">{data.video.author}</p>
									<p>{data.video.subCountText}</p>
								</div>
							</nav>
						</a>
						{#if $auth}
							<button
								on:click={toggleSubscribed}
								class:inverse-surface={!data.subscribed}
								class:border={data.subscribed}
							>
								{#if !data.subscribed}
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
					{#if data.returnYTDislikes}
						<nav class="no-space" style="margin-right: .5em;">
							<button style="cursor: default;" class="border left-round">
								<i class="small">thumb_up</i>
								<span>{cleanNumber(data.returnYTDislikes.likes)}</span>
							</button>
							<button style="cursor: default;" class="border right-round">
								<i class="small">thumb_down_alt</i>
								<span>{cleanNumber(data.returnYTDislikes.dislikes)}</span>
							</button>
						</nav>
					{/if}

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
								<a
									class="row"
									href="#copy"
									on:click={async () =>
										await navigator.clipboard.writeText(
											`${import.meta.env.VITE_DEFAULT_FRONTEND_URL}/watch/${data.video.videoId}`
										)}
								>
									<div class="min">{$_('player.share.materialiousLink')}</div></a
								><a
									href="#copy"
									class="row"
									on:click={async () =>
										await navigator.clipboard.writeText(
											`https://redirect.invidious.io/watch?v=${data.video.videoId}`
										)}
								>
									<div class="min">{$_('player.share.invidiousRedirect')}</div></a
								><a
									class="row"
									href="#copy"
									on:click={async () =>
										await navigator.clipboard.writeText(
											`https://www.youtube.com/watch?v=${data.video.videoId}`
										)}
								>
									<div class="min">{$_('player.share.youtubeLink')}</div></a
								></menu
							></button
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
						{#if data.personalPlaylists}
							<button class="border">
								<i>add</i>
								<div class="tooltip">{$_('player.addToPlaylist')}</div>
								<menu>
									{#each data.personalPlaylists as personalPlaylist}
										<a
											href="#add"
											on:click={async () => await addVideoToPlaylist(personalPlaylist.playlistId)}
											>{personalPlaylist.title}
										</a>
									{/each}
								</menu>
							</button>
						{:else}
							<button disabled class="border no-margin">
								<i>add</i>
								<div class="tooltip">
									{#if $auth}
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
				</details>
			</article>

			<div class="space"></div>
			{#if comments !== null && comments.comments !== undefined && comments.comments.length > 0}
				<h6>{numberWithCommas(comments.commentCount)} comments</h6>
				{#each comments.comments as comment}
					<Comment {comment} videoId={data.video.videoId}></Comment>
				{/each}
				{#if comments.continuation}
					<button on:click={loadMoreComments} class="margin">{$_('loadMore')}</button>
				{/if}
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
					<article
						style="height: 75vh; position: relative;"
						id="playlist"
						class="scroll no-padding"
					>
						<article class="no-elevate" style="position: sticky; top: 0; z-index: 3;">
							<h6>{playlist.title}</h6>
							<p>
								{cleanNumber(playlist.viewCount)}
								{$_('views')} • {playlist.videoCount}
								{$_('videos')}
							</p>
							<p><a href={`/channel/${playlist.authorId}`}>{playlist.author}</a></p>
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
								<Thumbnail video={playlistVideo} playlistId={data.playlistId} />
							</article>
						{/each}
					</article>
				{/if}
			</div>
		{/if}
	</div>
{:else}
	<PageLoading />
{/if}

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
			position: fixed;
			top: 50%;
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
