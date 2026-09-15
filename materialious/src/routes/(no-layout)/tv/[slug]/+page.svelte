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
	import { getNextFocus } from '@bbc/tv-lrud-spatial';
	import { keyCodeMap } from '$lib/utils';

	let { data } = $props();

	let playerElement: HTMLMediaElement | undefined = $state();
	let showInfo = $state(false);
	let infoPanel: HTMLElement | undefined = $state();
	let infoScope: HTMLElement | undefined = $state();
	let playerCurrentTime: number = $state(0);
	let showControls = $state(false);
	let currentTime = $state(0);
	let userManualSeeking = $state(false);

	let seekRaf: number | null = null;
	let seekStartTime = 0;
	let isSeeking = false;
	let lastUpdate = 0;
	let infoClosedByEnter = false;
	let keydownHandledMovement = false;

	const hasChapters = $derived(data.content.timestamps.length > 0);
	const hasPlaylist = $derived(!!data.playlistId && data.playlistId in $playlistCacheStore);
	const hasRecommended = $derived(data.video.recommendedVideos.length > 0);

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

		if (playerElement && !showInfo) {
			playerElement.currentTime = currentTime;
		}
	}

	function focusElement(el: HTMLElement | null | undefined) {
		if (!el) return;
		el.focus();
		el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	}

	function openInfo() {
		showInfo = true;

		tick().then(() => {
			if (infoScope) infoScope.scrollTop = 0;

			const first = infoScope?.querySelector<HTMLElement>(
				'[tabindex]:not([tabindex="-1"]), a, button, summary'
			);
			focusElement(first ?? infoPanel);
		});
	}

	function closeInfo() {
		showInfo = false;
		(document.activeElement as HTMLElement | null)?.blur();
	}

	function handleInfoKeyDown(event: KeyboardEvent) {
		if (event.defaultPrevented) {
			keydownHandledMovement = true;
			return;
		}

		keydownHandledMovement = false;
		if (event.key === 'Enter') return;

		const keyCode = keyCodeMap[event.key];
		if (!keyCode) return;

		const target = event.target;
		if (!(target instanceof Element)) return;

		const scope = infoScope;
		if (!scope) return;

		const nextFocus = getNextFocus(target, keyCode, scope);
		if (!nextFocus) return;

		const isFocusable =
			parseInt(nextFocus.getAttribute?.('tabindex') ?? '0', 10) > -1 ||
			['INPUT', 'SELECT', 'TEXTAREA'].includes(nextFocus.tagName);

		if (!isFocusable) return;

		event.preventDefault();
		keydownHandledMovement = true;
		focusElement(nextFocus);
	}

	function activateChapter(timestamp: { time: number }) {
		if (playerElement) playerElement.currentTime = timestamp.time;
		infoClosedByEnter = true;
		closeInfo();
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

				openInfo();

				return false;
			},
			'keyup'
		);

		Mousetrap.bind(
			'up',
			() => {
				if (!showInfo) {
					openInfo();
					return false;
				}

				const moved = keydownHandledMovement;
				keydownHandledMovement = false;

				if (moved) return true;

				const activeElement = document.activeElement;
				const atTop = activeElement?.id === 'info-close' || !infoScope || infoScope.scrollTop === 0;

				if (atTop) {
					closeInfo();
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
			'esc',
			() => {
				if (showInfo) {
					closeInfo();
					return false;
				}

				return true;
			},
			'keyup'
		);

		Mousetrap.bind(
			'enter',
			() => {
				if (infoClosedByEnter) {
					infoClosedByEnter = false;
					return true;
				}

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
		Mousetrap.unbind(['up', 'down', 'left', 'right', 'enter', 'esc']);
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
	<article
		id="shown-info"
		transition:fade
		bind:this={infoPanel}
		onkeydown={handleInfoKeyDown}
		role="dialog"
		aria-label={data.video.title}
	>
		<nav class="info-header">
			<h5>{letterCase(data.video.title)}</h5>
			<button
				id="info-close"
				class="circle surface-container-highest"
				aria-label={$_('player.closePlayer')}
				onclick={(event) => {
					if (event.detail === 0) infoClosedByEnter = true;
					closeInfo();
				}}
			>
				<i>close</i>
			</button>
		</nav>

		<div bind:this={infoScope} class="info-body" tabindex="-1">
			<section class="info-section">
				<Author channel={data.video} />
				<div class="space"></div>
				<LikesDislikes video={data.video} returnYTDislikes={data.streamed.returnYTDislikes} />
				<article class="border">
					<Description video={data.video} description={data.content.description} />
				</article>
			</section>

			{#if hasChapters}
				<section class="info-section">
					<h5 style="margin-bottom: 0;">{$_('player.chapters')}</h5>
					<div class="grid">
						{#each data.content.timestamps as timestamp, index (timestamp)}
							{@const isCurrent =
								playerCurrentTime >= timestamp.time &&
								(playerCurrentTime <= timestamp.endTime || timestamp.endTime === -1)}
							<ContentColumn>
								<article
									tabindex="0"
									id={`chapter-${index}`}
									aria-label={timestamp.title}
									class:chapter-current={isCurrent}
									style="cursor: pointer;height: 100%;"
									onclick={() => activateChapter(timestamp)}
									onkeydown={(event) => {
										if (event.key === 'Enter') {
											event.preventDefault();
											activateChapter(timestamp);
										}
									}}
								>
									<div
										style="white-space: pre-line; overflow-wrap: anywhere; word-break: break-word; text-align: center; min-width: 0;"
									>
										<p style="no-margin no-padding">{timestamp.title}</p>
										<span
											class="chip no-margin"
											class:primary={isCurrent}
											class:surface-container-highest={!isCurrent}>{timestamp.timePretty}</span
										>
									</div>
								</article>
							</ContentColumn>
						{/each}
					</div>
				</section>
			{/if}

			{#if hasPlaylist}
				<section class="info-section">
					<h5>{$_('playlistVideos')}</h5>
					<ItemsList classes="" items={$playlistCacheStore[data.playlistId!].videos} />
				</section>
			{/if}

			{#if hasRecommended}
				<section class="info-section">
					<h5>{$_('recommendedVideos')}</h5>
					<ItemsList classes="" items={data.video.recommendedVideos} />
				</section>
			{/if}
		</div>
	</article>
{/if}

<style>
	#shown-info {
		position: fixed;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 75%;
		z-index: 101;
		display: flex;
		flex-direction: column;
		background-color: var(--surface);
		box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.4);
		border-bottom-left-radius: 0px;
		border-bottom-right-radius: 0px;
	}

	.info-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1em;
		padding: 0.75em 1em;
		border-bottom: 1px solid var(--outline-variant);
		flex-shrink: 0;
	}

	.info-header h5 {
		margin: 0;
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
		white-space: normal;
	}

	.info-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 1em;
	}

	.info-body:focus {
		outline: none !important;
	}

	.info-section {
		margin-bottom: 1.5em;
	}

	.chapter-current {
		background-color: var(--primary-container);
		color: var(--on-primary-container);
	}
</style>
