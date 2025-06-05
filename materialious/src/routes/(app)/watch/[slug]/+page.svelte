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
	import { cleanNumber, humanizeSeconds, numberWithCommas } from '$lib/numbers';
	import type { PlayerEvents } from '$lib/player.js';
	import {
		authStore,
		interfaceAutoExpandChapters,
		interfaceAutoExpandComments,
		interfaceAutoExpandDesc,
		interfaceLowBandwidthMode,
		playerAutoplayNextByDefaultStore,
		playerTheatreModeByDefaultStore,
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

	let { data = $bindable() } = $props();

	let playerElement: HTMLMediaElement | undefined = $state();

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

	let playlistVideos: PlaylistPageVideo[] = $state([]);
	let playlist: PlaylistPage | null = $state(null);

	let loopPlaylist: boolean = $state(false);
	let shufflePlaylist: boolean = $state(false);

	let theatreMode = $state(get(playerTheatreModeByDefaultStore));

	let segments: Segment[] = $state([]);

	let pauseTimerSeconds: number = $state(-1);

	let showTranscript = $state(false);

	let playerCurrentTime: number = $state(0);

	function expandSummery(id: string) {
		const element = document.getElementById(id);
		if (element) {
			element.click();
		}
	}

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
					await loadPlaylist(event.playlistId);
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
		if ($interfaceAutoExpandDesc) {
			expandSummery('description');
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

			playerElement.addEventListener('ended', async () => {
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

	let pauseTimeout: NodeJS.Timeout | undefined = $state();
	function setPauseTimer() {
		if (pauseTimeout) {
			clearTimeout(pauseTimeout);
		}
		pauseTimeout = setTimeout(() => {
			// player.pause();
			pauseTimerSeconds = 0;
			clearTimeout(pauseTimeout);
		}, pauseTimerSeconds * 1000);

		ui('#pause-timer');
	}
</script>

<svelte:head>
	<title>{data.video.title} | Materialious</title>
</svelte:head>

<div class="space"></div>

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
				<nav>
					<a href={`/channel/${data.video.authorId}`}>
						<nav style="gap: 0.5em;">
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
						<nav class="no-space">
							<button style="cursor: default;" class="border left-round">
								<i class="small">thumb_up</i>
								<span>{cleanNumber(returnYTDislikes.likes)}</span>
							</button>
							<button style="cursor: default;margin-right: 0.5em;" class="border right-round">
								<i class="small">thumb_down_alt</i>
								<span>{cleanNumber(returnYTDislikes.dislikes)}</span>
							</button>
						</nav>
					{:else}
						<button style="cursor: default;margin-right: 0.5em;" class="border">
							<i class="small">thumb_up</i>
							<span>{cleanNumber(data.video.likeCount)}</span>
						</button>
					{/if}
				{/await}

				<div>
					<button onclick={toggleTheatreMode} class="m l" class:border={!theatreMode}>
						<i>width_wide</i>
						<div class="tooltip">{$_('player.theatreMode')}</div>
					</button>
					{#if data.video.lengthSeconds > 360 && !data.video.hlsUrl}
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
						<menu class="no-wrap mobile">
							<ShareVideo video={data.video} />
						</menu></button
					>
					{#if personalPlaylists}
						<button class="border">
							<i>add</i>
							<div class="tooltip">{$_('player.addToPlaylist')}</div>
							<menu class="no-wrap mobile">
								{#each personalPlaylists as personalPlaylist}
									<button
										class="row"
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
									</button>
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
				<summary id="description" class="bold none">
					<nav>
						<div class="max">
							{numberWithCommas(data.video.viewCount)}
							{$_('views')} • {data.video.publishedText}
						</div>
						<i>expand_more</i>
					</nav>
				</summary>
				<div class="space"></div>
				<div class="medium scroll">
					<div style="white-space: pre-line; overflow-wrap: break-word;">
						{@html data.content.description}
					</div>
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

		{#if data.content.timestamps.length > 0}
			<article>
				<details>
					<summary id="chapter-section" class="bold none">
						<nav>
							<div class="max">
								<p>{$_('player.chapters')}</p>
							</div>
							<i>expand_more</i>
						</nav>
					</summary>
					<div class="space"></div>
					<div class="chapter-list">
						<ul class="list">
							{#each data.content.timestamps as timestamp}
								<li
									onclick={() => {
										if (playerElement) playerElement.currentTime = timestamp.time;
									}}
								>
									<img
										class="round large"
										src={getBestThumbnail(data.video.videoThumbnails) as string}
										alt="Thumbnail for current video"
									/>
									<div class="max" style="white-space: pre-line; overflow-wrap: break-word;">
										<p>{timestamp.title}</p>
										<span class="chip fill no-margin">{timestamp.timePretty}</span>
									</div>
								</li>
							{/each}
						</ul>
					</div>
				</details>
			</article>
		{/if}

		{#if comments && comments.comments.length > 0}
			<article>
				<details>
					<summary id="comment-section" class="none bold">
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
			{#if showTranscript && playerElement}
				<Transcript video={data.video} bind:playerElement />
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
	.chapter-list {
		max-height: 300px;
		overflow-x: scroll;
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

	@media screen and (max-width: 1646px) {
		.grid {
			padding: 0;
		}
	}
</style>
