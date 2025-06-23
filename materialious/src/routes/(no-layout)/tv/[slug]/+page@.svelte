<script lang="ts">
	import ContentColumn from '$lib/components/ContentColumn.svelte';
	import Player from '$lib/components/Player.svelte';
	import Thumbnail from '$lib/components/Thumbnail.svelte';
	import Author from '$lib/components/Watch/Author.svelte';
	import Description from '$lib/components/Watch/Description.svelte';
	import LikesDislikes from '$lib/components/Watch/LikesDislikes.svelte';
	import { letterCase } from '$lib/letterCasing.js';
	import Mousetrap from 'mousetrap';
	import { onDestroy, onMount, tick } from 'svelte';
	import { _ } from '$lib/i18n';
	import { playlistCacheStore } from '$lib/store.js';

	let { data } = $props();

	let playerElement: HTMLMediaElement | undefined = $state();
	let showInfo = $state(false);

	let subscribed: boolean = $state(false);
	data.streamed.subscribed.then((isSubbed) => (subscribed = isSubbed));

	onMount(() => {
		Mousetrap.bind('down', () => {
			if (showInfo) return true;

			showInfo = true;
			tick().then(() => {
				document.getElementById('shown-info')?.focus();
			});

			return false;
		});

		Mousetrap.bind('up', () => {
			const infoElement = document.getElementById('shown-info');

			if (showInfo && infoElement) {
				if (infoElement.scrollTop === 0) {
					showInfo = false;
					return false;
				}
				return true;
			}

			if (!showInfo) {
				showInfo = true;
				tick().then(() => {
					document.getElementById('shown-info')?.focus();
				});
				return false;
			}

			return true;
		});

		Mousetrap.bind('right', () => {
			if (!playerElement || showInfo) return true;
			playerElement.currentTime = playerElement.currentTime + 10;
			return false;
		});

		Mousetrap.bind('left', () => {
			if (!playerElement || showInfo) return true;

			playerElement.currentTime = playerElement.currentTime - 10;
			return false;
		});

		Mousetrap.bind('enter', () => {
			if (showInfo) return true;

			if (playerElement?.paused) {
				playerElement?.play();
			} else {
				playerElement?.pause();
			}
			return false;
		});
	});

	onDestroy(() => {
		Mousetrap.unbind(['up', 'down', 'left', 'right']);
	});
</script>

<Player bind:playerElement isEmbed={true} {data} />

{#if showInfo}
	<article id="shown-info">
		<h5>{letterCase(data.video.title)}</h5>
		<Author bind:subscribed video={data.video} />
		<div class="space"></div>
		<LikesDislikes video={data.video} returnYTDislikes={data.streamed.returnYTDislikes} />
		<article class="border">
			<Description video={data.video} description={data.content.description} />
		</article>

		{#if data.playlistId && data.playlistId in $playlistCacheStore}
			<h5 style="margin-bottom: 0;">{$_('playlistVideos')}</h5>

			<div class="grid">
				{#each $playlistCacheStore[data.playlistId].videos as playlistVideo}
					<ContentColumn>
						<article
							class="no-padding primary-border"
							style="height: 100%;"
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
					</ContentColumn>
				{/each}
			</div>
		{/if}
		<h5 style="margin-bottom: 0;">{$_('recommendedVideos')}</h5>
		<div class="grid">
			{#each data.video.recommendedVideos as recommendedVideo}
				<ContentColumn>
					<article style="height: 100%;" class="no-padding">
						{#key recommendedVideo.videoId}
							<Thumbnail video={recommendedVideo} sideways={false} />
						{/key}
					</article>
				</ContentColumn>
			{/each}
		</div>
	</article>
{/if}

<style>
	#shown-info {
		position: fixed;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 40%;
		z-index: 101;
		overflow-y: scroll;
	}
</style>
