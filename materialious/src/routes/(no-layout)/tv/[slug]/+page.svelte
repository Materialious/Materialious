<script lang="ts">
	import ContentColumn from '$lib/components/layout/ContentColumn.svelte';
	import Player from '$lib/components/player/Player.svelte';
	import Author from '$lib/components/Author.svelte';
	import Description from '$lib/components/watch/Description.svelte';
	import LikesDislikes from '$lib/components/watch/LikesDislikes.svelte';
	import { letterCase } from '$lib/letterCasing';
	import Mousetrap from 'mousetrap';
	import { onDestroy, onMount, tick } from 'svelte';
	import { _ } from '$lib/i18n';
	import { playlistCacheStore } from '$lib/store';
	import { fade } from 'svelte/transition';
	import ItemsList from '$lib/components/layout/ItemsList.svelte';

	let { data } = $props();

	let playerElement: HTMLMediaElement | undefined = $state();
	let showInfo = $state(false);
	let playerCurrentTime: number = $state(0);
	let showControls = $state(false);
	let currentTime = $state(0);
	let userManualSeeking = $state(false);

	let seekRaf: number | null = null;
	let seekStartTime = 0;
	let isSeeking = false;
	let lastUpdate = 0;

	function startSeeking(direction: 'left' | 'right') {
		showControls = true;

		if (!playerElement || showInfo || isSeeking) return true;

		userManualSeeking = true;
		isSeeking = true;
		lastUpdate = performance.now();

		const duration = data.video.lengthSeconds;
		const base = duration * 0.005; // ~0.5%

		function step(now: number) {
			if (!isSeeking) return;

			const elapsedTotal = (now - seekStartTime) / 1000; // total hold time
			const throttleDelta = now - lastUpdate;

			// only update every ~100ms so we don’t overshoot
			if (throttleDelta > 100) {
				const factor = 1 + Math.min(elapsedTotal ** 1.2, 3); // gentler acceleration
				const amount = base * factor;

				if (direction === 'right') {
					currentTime = Math.min(currentTime + amount, duration);
				} else {
					currentTime = Math.max(currentTime - amount, 0);
				}

				lastUpdate = now;
			}

			seekRaf = requestAnimationFrame(step);
		}

		seekStartTime = performance.now();
		seekRaf = requestAnimationFrame(step);

		return false;
	}

	function stopSeeking() {
		isSeeking = false;
		showControls = false;
		userManualSeeking = false;

		if (seekRaf !== null) {
			cancelAnimationFrame(seekRaf);
			seekRaf = null;
		}

		if (playerElement) {
			playerElement.currentTime = currentTime;
		}
	}

	onMount(() => {
		if (playerElement) {
			playerElement.addEventListener('timeupdate', () => {
				if (!playerElement) return;
				playerCurrentTime = playerElement.currentTime;
			});
		}

		Mousetrap.bind(
			'down',
			() => {
				if (showInfo) return true;

				showInfo = true;
				tick().then(() => {
					document.getElementById('shown-info')?.focus();
				});

				return false;
			},
			'keyup'
		);

		Mousetrap.bind(
			'up',
			() => {
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
			},
			'keyup'
		);

		// Arrow key seeking bindings
		Mousetrap.bind('right', () => startSeeking('right'), 'keydown');
		Mousetrap.bind('right', stopSeeking, 'keyup');
		Mousetrap.bind('left', () => startSeeking('left'), 'keydown');
		Mousetrap.bind('left', stopSeeking, 'keyup');

		Mousetrap.bind(
			'enter',
			() => {
				if (!showInfo) {
					if (playerElement?.paused) {
						showControls = false;
						playerElement?.play();
					} else {
						showControls = true;

						playerElement?.pause();
					}
					return false;
				}

				return true;
			},
			'keyup'
		);
	});

	onDestroy(() => {
		Mousetrap.unbind(['up', 'down', 'left', 'right', 'enter']);
	});
</script>

{#key data.video.videoId}
	<Player
		bind:playerElement
		bind:currentTime
		bind:userManualSeeking
		isEmbed={true}
		{data}
		{showControls}
	/>
{/key}

{#if showInfo}
	<article id="shown-info" transition:fade>
		<h5>{letterCase(data.video.title)}</h5>
		<Author channel={data.video} />
		<div class="space"></div>
		<LikesDislikes video={data.video} returnYTDislikes={data.streamed.returnYTDislikes} />
		<article class="border">
			<Description video={data.video} description={data.content.description} />
		</article>

		{#if data.content.timestamps.length > 0}
			<h5 style="margin-bottom: 0;">{$_('player.chapters')}</h5>
			<div class="grid">
				{#each data.content.timestamps as timestamp (timestamp)}
					<ContentColumn>
						<article
							role="presentation"
							style="cursor: pointer;height: 100%;"
							onclick={() => {
								if (playerElement) playerElement.currentTime = timestamp.time;
								showInfo = false;
							}}
						>
							<div style="white-space: pre-line; overflow-wrap: break-word;text-align: center;">
								<p style="no-margin no-padding">{timestamp.title}</p>
								<span
									class:primary={playerCurrentTime >= timestamp.time &&
										(playerCurrentTime <= timestamp.endTime || timestamp.endTime === -1)}
									class="chip no-margin">{timestamp.timePretty}</span
								>
							</div>
						</article>
					</ContentColumn>
				{/each}
			</div>
		{/if}

		{#if data.playlistId && data.playlistId in $playlistCacheStore}
			<h5 style="margin-bottom: 0;">{$_('playlistVideos')}</h5>
			<ItemsList classes="" items={$playlistCacheStore[data.playlistId].videos} />
		{/if}
		{#if data.video.recommendedVideos.length > 0}
			<h5 style="margin-bottom: 0;">{$_('recommendedVideos')}</h5>
			<ItemsList classes="" items={data.video.recommendedVideos} />
		{/if}
	</article>
{/if}

<style>
	#shown-info {
		position: fixed;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 50%;
		z-index: 101;
		overflow-y: scroll;
		border-bottom-left-radius: 0px;
		border-bottom-right-radius: 0px;
	}
</style>
