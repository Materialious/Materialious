<script lang="ts">
	import { isMobile } from '$lib/misc';
	import { playerDoubleTapSeek } from '$lib/player';
	import { onDestroy } from 'svelte';

	let {
		playerElement,
		showPlayerUI,
		toggleVideoPlaybackStatus,
		toggleFullscreen,
		playerMaxKnownTime = $bindable(),
		playerIsBuffering = $bindable(),
		playerInitalInteract = $bindable()
	}: {
		showPlayerUI: () => void;
		toggleVideoPlaybackStatus: () => void;
		toggleFullscreen: () => void;
		playerElement: HTMLMediaElement | undefined;
		playerMaxKnownTime: number;
		playerIsBuffering: boolean;
		playerInitalInteract: boolean;
	} = $props();

	let clickCount = $state(0);
	let clickCounterTimeout: ReturnType<typeof setTimeout>;

	let seekDirection: 'forwards' | 'backwards' | undefined = $state();

	function onTouchControl(type: 'pause' | 'seekLeft' | 'seekRight') {
		seekDirection = undefined;

		if (!playerElement) return;

		if (isMobile() && playerInitalInteract) {
			showPlayerUI();
			playerInitalInteract = false;
			clickCount = 0;
			return;
		}

		clickCount++;

		if (clickCounterTimeout) clearTimeout(clickCounterTimeout);

		clickCounterTimeout = setTimeout(() => {
			if (clickCount == 1) {
				toggleVideoPlaybackStatus();
			}
			clickCount = 0;
		}, 200);

		if (clickCount < 2) return;

		if (type === 'seekLeft') {
			seekDirection = 'backwards';
			playerElement.currentTime = Math.max(0, playerElement.currentTime - playerDoubleTapSeek);
		} else if (type === 'pause') {
			toggleFullscreen();
		} else {
			seekDirection = 'forwards';
			playerElement.currentTime = Math.min(
				playerMaxKnownTime,
				playerElement.currentTime + playerDoubleTapSeek
			);
		}
	}

	onDestroy(() => {
		if (clickCounterTimeout) clearTimeout(clickCounterTimeout);
	});
</script>

<div id="player-center">
	<div class="grid">
		<div class="s4 m4 l4" onclick={() => onTouchControl('seekLeft')} role="presentation">
			{#if clickCount > 1 && seekDirection === 'backwards'}
				<div class="seek-double-click" class:buffer-left={seekDirection === 'backwards'}>
					<h4>-{(clickCount - 1) * playerDoubleTapSeek}</h4>
				</div>
			{/if}
		</div>
		<div class="s4 m4 l4" onclick={() => onTouchControl('pause')} role="presentation">
			<div class="player-status">
				{#if playerIsBuffering}
					<progress class="circle large indeterminate" value="50" max="100"></progress>
				{/if}
			</div>
		</div>
		<div class="s4 m4 l4" onclick={() => onTouchControl('seekRight')} role="presentation">
			{#if clickCount > 1 && seekDirection === 'forwards'}
				<div class="seek-double-click" class:buffer-right={seekDirection === 'forwards'}>
					<h4>+{(clickCount - 1) * playerDoubleTapSeek}</h4>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	#player-center {
		position: absolute;
		width: 100%;
		height: 100%;
	}

	.seek-double-click {
		background-color: var(--secondary-container);
		height: var(--video-player-height);
		color: var(--secondary);
		width: 100%;
		opacity: 0.8;
		padding: 1em;
		display: flex;
		justify-content: center;
		align-items: center;
		user-select: none;
	}

	.seek-double-click.buffer-right {
		border-top-left-radius: 0.25rem;
		border-bottom-left-radius: 0.25rem;
	}

	.seek-double-click.buffer-left {
		border-top-right-radius: 0.25rem;
		border-bottom-right-radius: 0.25rem;
	}

	.player-status {
		display: flex;
		justify-content: center;
		align-items: center;
		height: var(--video-player-height);
	}
</style>
