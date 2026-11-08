<script lang="ts">
	import ContentColumn from '#lib/components/layout/ContentColumn.svelte';
	import Player from '#lib/components/player/Player.svelte';
	import TvControls from '#lib/components/player/TvControls.svelte';
	import Author from '#lib/components/Author.svelte';
	import Description from '#lib/components/watch/Description.svelte';
	import LikesDislikes from '#lib/components/watch/LikesDislikes.svelte';
	import { letterCase } from '#lib/letterCasing';
	import Mousetrap from 'mousetrap';
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { _ } from '#lib/i18n/index';
	import { playlistCacheStore, playlistSettingsStore } from '#lib/store';
	import { fade } from 'svelte/transition';
	import ItemsList from '#lib/components/layout/ItemsList.svelte';
	import { getNextFocus } from '@bbc/tv-lrud-spatial';
	import { isAndroidTv, keyCodeMap } from '#lib/utils';
	import type { Segment } from 'sponsorblock-api';
	import type shaka from 'shaka-player/dist/shaka-player.ui';
	import TvSettings from '#lib/components/player/settings/TvSettings.svelte';
	import { goToNextVideo } from '#lib/player/index';
	import { goto } from '$app/navigation';
	import { resolveWatchPath } from '#lib/paths';
	import { isItemFiltered } from '#lib/filtering/index';

	let { data } = $props();

	let playerElement: HTMLMediaElement | undefined = $state();
	let shakaPlayer: shaka.Player | undefined = $state();
	// SponsorBlock segments, fetched inside Player and shared with TvControls.
	let tvSegments: Segment[] = $state([]);
	let showTvSettings = $state(false);
	let tvSettings: TvSettings | undefined = $state();
	// The TV control bar is a row of buttons in TvControls; focus moves along it by
	// index (←/→) and Down opens the info sheet from any button.
	let controlsPinned = $state(false);
	let tvControlsRow: HTMLElement | undefined = $state();
	let tvTimeline: HTMLElement | undefined = $state();
	// Overlays opened from the control bar hand focus back to the button they came from.
	let returnFocusTo: HTMLElement | undefined;
	let controlsPinTimeout: ReturnType<typeof setTimeout> | undefined;
	let showInfo = $state(false);
	let infoPanel: HTMLElement | undefined = $state();
	let infoScope: HTMLElement | undefined = $state();
	let playerCurrentTime: number = $state(0);
	// Single owner of "bar visible": syncControls() derives it from pinned / seeking /
	// paused. Player's own mouse/auto-hide logic is disabled on TV.
	let showControls = $state(false);
	let paused = $state(false);
	// Bar shown because of a pause. Back dismisses it without resuming; a new pause (or a
	// key press) brings it back, so it never re-shows by itself.
	let pauseBar = $state(false);
	let hasStartedPlaying = false;
	let currentTime = $state(0);
	let userManualSeeking = $state(false);

	let seekRaf: number | null = null;
	let seekStartTime = 0;
	let isSeeking = false;
	let lastUpdate = 0;
	let infoClosedByEnter = false;
	let keydownHandledMovement = false;
	let enterStartedOnControl = false;

	const hasChapters = $derived(data.content.timestamps.length > 0);
	const hasPlaylist = $derived(!!data.playlistId && data.playlistId in $playlistCacheStore);
	const hasRecommended = $derived(data.video.recommendedVideos.length > 0);

	// Next-video button: playlist successor, else the first unfiltered recommendation.
	const playlistVideos = $derived(
		hasPlaylist ? $playlistCacheStore[data.playlistId!].videos : undefined
	);
	const nextRecommended = $derived(
		data.video.recommendedVideos.find((video) => !isItemFiltered(video))
	);
	const hasNextVideo = $derived(
		hasPlaylist
			? !!playlistVideos &&
					(playlistVideos.findIndex((video) => video.videoId === data.video.videoId) + 1 <
						playlistVideos.length ||
						$playlistSettingsStore[data.playlistId!]?.loop)
			: !!nextRecommended
	);
	const playlistPosition = $derived.by(() => {
		if (!playlistVideos) return undefined;
		const index = playlistVideos.findIndex((video) => video.videoId === data.video.videoId);
		return index === -1 ? undefined : `${index + 1} / ${playlistVideos.length}`;
	});

	function syncControls() {
		showControls = controlsPinned || isSeeking || pauseBar;
	}

	function startSeeking(direction: 'left' | 'right') {
		const onTimeline = isTimelineFocused();

		if (!showInfo && !showTvSettings && !onTimeline && (isControlFocused() || paused)) {
			// Bar focused, or video paused (bar is up): ←/→ walk the button row, never seek.
			if (isControlFocused()) {
				const keyCode = keyCodeMap[direction === 'right' ? 'ArrowRight' : 'ArrowLeft'];
				const next = getNextFocus(document.activeElement, keyCode, tvControlsRow);
				if (next instanceof HTMLElement) focusControl(next);
			} else {
				focusControl(rowButtons()[0]);
			}
			pinControls();
			return false;
		}

		if (!playerElement || showInfo || showTvSettings || isSeeking) return true;

		userManualSeeking = true;
		isSeeking = true;
		syncControls();
		lastUpdate = performance.now();

		const duration = data.video.lengthSeconds;
		const base = duration * 0.005; // ~0.5%

		// A tap is shorter than the 100ms seek throttle; on the paused timeline it still
		// moves one base step.
		if (onTimeline) {
			currentTime =
				direction === 'right'
					? Math.min(currentTime + base, duration)
					: Math.max(currentTime - base, 0);
		}

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
		const wasSeeking = isSeeking;
		isSeeking = false;
		syncControls();
		userManualSeeking = false;

		if (seekRaf !== null) {
			cancelAnimationFrame(seekRaf);
			seekRaf = null;
		}

		// Only seek when this key press actually scrubbed; a key-up after moving focus
		// would otherwise re-seek to the current position and stutter the video.
		if (wasSeeking && playerElement && !showInfo && !showTvSettings) {
			playerElement.currentTime = currentTime;
		}
	}

	function focusElement(el: HTMLElement | null | undefined) {
		if (!el) return;
		el.focus();
		el.scrollIntoView({ block: 'center', inline: 'nearest' });
	}

	// preventScroll: focusing inside the clipped player container must not shift the video.
	function focusControl(element: HTMLElement | undefined) {
		// The bar toggles `visibility` and a hidden element can't take focus, so retry for a
		// few frames until the visible state has reached the DOM.
		let attempts = 0;
		const tryFocus = () => {
			element?.focus({ preventScroll: true });
			if (element && document.activeElement !== element && attempts++ < 10)
				requestAnimationFrame(tryFocus);
		};
		tick().then(tryFocus);
	}

	// The button row lives in TvControls; buttons carry data-tv-button and render
	// conditionally, so the row is queried rather than kept as fixed refs.
	function rowButtons(): HTMLButtonElement[] {
		return tvControlsRow
			? Array.from(tvControlsRow.querySelectorAll<HTMLButtonElement>('button[data-tv-button]'))
			: [];
	}

	// Paused only: Up moves focus onto the progress bar so Left/Right can scrub.
	const isTimelineFocused = () => !!tvTimeline && document.activeElement === tvTimeline;
	const isBarFocused = () => isControlFocused() || isTimelineFocused();

	const isControlFocused = () =>
		!!tvControlsRow && !!document.activeElement && tvControlsRow.contains(document.activeElement);

	function pinControls() {
		controlsPinned = true;
		syncControls();

		clearTimeout(controlsPinTimeout);
		controlsPinTimeout = setTimeout(unpinControls, 6000);
	}

	function unpinControls() {
		if (!controlsPinned) return;

		clearTimeout(controlsPinTimeout);
		controlsPinned = false;
		syncControls();

		// While the pause bar is up it keeps its focus.
		if (!pauseBar && isBarFocused()) (document.activeElement as HTMLElement).blur();
	}

	// Back/Esc on a visible bar: hide it entirely. A paused video stays paused.
	function hideBar() {
		clearTimeout(controlsPinTimeout);
		controlsPinned = false;
		pauseBar = false;
		syncControls();
		if (isBarFocused()) (document.activeElement as HTMLElement).blur();
	}

	function openInfo() {
		unpinControls();
		showInfo = true;

		tick().then(() => {
			if (infoScope) infoScope.scrollTop = 0;

			const first = infoScope?.querySelector<HTMLElement>(
				'[tabindex]:not([tabindex="-1"]), a, button, summary'
			);
			focusElement(first ?? infoPanel);
		});
	}

	function openTvSettings(opener: HTMLElement) {
		returnFocusTo = opener;
		unpinControls();
		showTvSettings = true;
	}

	function openInfoFromButton(opener: HTMLElement) {
		returnFocusTo = opener;
		openInfo();
	}

	function playNextVideo() {
		if (hasPlaylist) {
			void goToNextVideo(data.video, data.playlistId);
		} else if (nextRecommended) {
			goto(resolveWatchPath(nextRecommended.videoId), { replace: isAndroidTv() });
		}
	}

	function togglePlayback() {
		if (!playerElement) return;
		if (playerElement.paused) playerElement.play();
		else playerElement.pause();
	}

	function restoreControlFocus() {
		if (!returnFocusTo) return;

		const target = returnFocusTo;
		returnFocusTo = undefined;
		pinControls();
		focusControl(target);
	}

	function closeInfo() {
		showInfo = false;
		(document.activeElement as HTMLElement | null)?.blur();
		restoreControlFocus();
	}

	function closeTvSettings() {
		// Back first goes up a level (quality list -> root); only root closes the panel.
		if (tvSettings?.back()) return;
		showTvSettings = false;
		(document.activeElement as HTMLElement | null)?.blur();
		restoreControlFocus();
	}

	function handleInfoKeyDown(event: KeyboardEvent) {
		if (event.defaultPrevented) {
			keydownHandledMovement = true;
			return;
		}

		keydownHandledMovement = false;
		const keyCode = keyCodeMap[event.key];
		if (!keyCode || keyCode === 13 || !infoPanel) return;

		const next = getNextFocus(document.activeElement, keyCode, infoPanel);
		if (next instanceof HTMLElement) {
			event.preventDefault();
			keydownHandledMovement = true;
			focusElement(next);
		}
	}

	function activateChapter(timestamp: { time: number }) {
		if (playerElement) playerElement.currentTime = timestamp.time;
		infoClosedByEnter = true;
		closeInfo();
	}

	function handleBack(event: Event) {
		if (showTvSettings) {
			event.preventDefault();
			closeTvSettings();
			return;
		}

		if (!showInfo) {
			if (controlsPinned || pauseBar) {
				event.preventDefault();
				hideBar();
			}
			return;
		}
		event.preventDefault();
		closeInfo();
	}

	// A pause after playback has started shows the bar with focus on Play; play hides it
	// again (Enter on Play resumes). The initial not-yet-playing state is not a pause:
	// the bar stays away while the video loads/buffers.
	function showPauseBar() {
		pauseBar = true;
		syncControls();
		if (!showInfo && !showTvSettings) focusControl(rowButtons()[0]);
	}

	function onVideoPause() {
		if (playerElement?.ended) return;
		paused = true;
		if (hasStartedPlaying) showPauseBar();
	}

	function onVideoPlay() {
		paused = false;
		pauseBar = false;
		unpinControls();
		syncControls();
	}

	function onVideoPlaying() {
		hasStartedPlaying = true;
	}

	// Autoplay blocked or failed: the video is loaded but stays paused. After a short
	// grace period (autoplay normally starts right after canplay) show the bar so the
	// user can press Play.
	let autoplayFallback: ReturnType<typeof setTimeout> | undefined;
	function onVideoCanPlay() {
		if (hasStartedPlaying) return;
		clearTimeout(autoplayFallback);
		autoplayFallback = setTimeout(() => {
			if (!hasStartedPlaying && playerElement?.paused) showPauseBar();
		}, 2500);
	}

	$effect(() => {
		const element = playerElement;
		if (!element) return;

		// untrack: syncControls() reads other state; without it every pin/pause change
		// re-ran this effect and reset hasStartedPlaying.
		untrack(() => {
			paused = element.paused;
			hasStartedPlaying = false;
			pauseBar = false;
			syncControls();
		});
		element.addEventListener('pause', onVideoPause);
		element.addEventListener('play', onVideoPlay);
		element.addEventListener('playing', onVideoPlaying);
		element.addEventListener('canplay', onVideoCanPlay);
		return () => {
			clearTimeout(autoplayFallback);
			element.removeEventListener('pause', onVideoPause);
			element.removeEventListener('play', onVideoPlay);
			element.removeEventListener('playing', onVideoPlaying);
			element.removeEventListener('canplay', onVideoCanPlay);
		};
	});

	onMount(() => {
		window.addEventListener('materialious:back', handleBack);

		if (playerElement) {
			playerElement.addEventListener('timeupdate', () => {
				if (!playerElement) return;
				playerCurrentTime = playerElement.currentTime;
			});
		}

		Mousetrap.bind(
			'down',
			() => {
				if (showInfo || showTvSettings) return true;

				if (isControlFocused()) {
					returnFocusTo = document.activeElement as HTMLElement;
					openInfo();
				} else {
					pinControls();
					focusControl(rowButtons()[0]);
				}

				return false;
			},
			'keyup'
		);

		Mousetrap.bind(
			'up',
			() => {
				if (showTvSettings) return true;

				if (!showInfo) {
					if (paused) {
						// Paused: Up goes to the timeline (showing the bar first if hidden) so the
						// user can scrub; Down returns to the buttons, which keep the info sheet.
						if (!isTimelineFocused()) {
							pauseBar = true;
							syncControls();
							focusControl(tvTimeline);
						}
					} else if (isControlFocused()) unpinControls();
					else openInfo();

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
		// Up/down act on key-up, so stop the WebView from also moving focus natively on key-down.
		Mousetrap.bind(['up', 'down'], () => !isBarFocused(), 'keydown');
		Mousetrap.bind('right', () => startSeeking('right'), 'keydown');
		Mousetrap.bind('right', stopSeeking, 'keyup');
		Mousetrap.bind('left', () => startSeeking('left'), 'keydown');
		Mousetrap.bind('left', stopSeeking, 'keyup');

		Mousetrap.bind(
			'esc',
			() => {
				if (showTvSettings) {
					closeTvSettings();
					return false;
				}

				if (showInfo) {
					closeInfo();
					return false;
				}

				if (controlsPinned || pauseBar) {
					hideBar();
					return false;
				}

				return true;
			},
			'keyup'
		);

		Mousetrap.bind(
			'enter',
			() => {
				enterStartedOnControl = isControlFocused();
				return true;
			},
			'keydown'
		);

		Mousetrap.bind(
			'enter',
			() => {
				if (showTvSettings) return true;

				// Enter on a focused control is a native click, handled by the button itself.
				// The press may have moved focus away (Play hides the bar), so use the
				// state captured on key-down or it would toggle playback a second time.
				if (enterStartedOnControl || isControlFocused()) {
					enterStartedOnControl = false;
					return true;
				}

				if (infoClosedByEnter) {
					infoClosedByEnter = false;
					return true;
				}

				if (!showInfo) {
					togglePlayback();
					return false;
				}

				return true;
			},
			'keyup'
		);
	});

	onDestroy(() => {
		window.removeEventListener('materialious:back', handleBack);
		clearTimeout(controlsPinTimeout);
		// unbind() only removes the default action; these were bound on keyup too.
		Mousetrap.unbind(['up', 'down', 'left', 'right', 'enter', 'esc']);
		Mousetrap.unbind(['up', 'down', 'left', 'right', 'enter', 'esc'], 'keyup');
	});
</script>

{#key data.video.videoId}
	<Player
		bind:playerElement
		onShakaPlayer={(player) => (shakaPlayer = player)}
		bind:currentTime
		bind:userManualSeeking
		bind:showControls
		bind:segments={tvSegments}
		holdControls={controlsPinned}
		isEmbed={true}
		{data}
	/>
{/key}
<TvControls
	bind:rowElement={tvControlsRow}
	bind:timelineElement={tvTimeline}
	video={data.video}
	content={data.content}
	segments={tvSegments}
	{playerElement}
	{currentTime}
	{userManualSeeking}
	visible={showControls}
	{playlistPosition}
	hasNext={hasNextVideo}
	onPlayPause={togglePlayback}
	onNext={playNextVideo}
	onSettings={openTvSettings}
	onInfo={openInfoFromButton}
/>
{#if showTvSettings && shakaPlayer && playerElement}
	<TvSettings bind:this={tvSettings} player={shakaPlayer} {playerElement} video={data.video} />
{/if}

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
	/* The (no-layout) route never gets the app layout that sets this, which left the
	   buffering spinner stuck to the top of the player. The TV player fills the screen. */
	:global(#player-container) {
		--video-player-height: 100vh;
	}

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
