<script lang="ts">
	import ui from 'beercss';
	import { _ } from '#lib/i18n/index';
	import { humanizeSeconds } from '#lib/time';
	import { sleepTimerStore } from '#lib/store';

	let {
		pauseTimerSeconds = $bindable(),
		pauseTimerRemaining = $bindable(),
		setPauseTimer,
		clearPauseTimer
	}: {
		pauseTimerSeconds: number;
		pauseTimerRemaining: number;
		setPauseTimer: () => void;
		clearPauseTimer: () => void;
	} = $props();
</script>

<dialog id="pause-timer">
	<div>
		<nav class="no-space">
			<h6 class="max">
				{#if pauseTimerSeconds > 0}
					{$_('player.pauseVideoIn')} {humanizeSeconds(pauseTimerRemaining)}
				{:else}
					{$_('player.pauseTimer')}
				{/if}
			</h6>
			<button onclick={() => ui('#pause-timer')} class="circle surface-container-highest">
				<i>close</i>
			</button>
		</nav>

		<div class="space"></div>

		<div class="grid" style="gap: 0.5em;">
			{#each [300, 600, 1800, 3600, 7200] as duration (duration)}
				<div class="s4 m4 l4">
					<button
						onclick={() => {
							pauseTimerSeconds = duration;
							pauseTimerRemaining = duration;
							setPauseTimer();
							ui('#pause-timer');
						}}
						class="max surface-container-highest"
						style="width: 100%; padding: 0.75em 0;">{duration < 3600
							? `${duration / 60} min`
							: `${duration / 3600} hr`}</button
					>
				</div>
			{/each}
			<div class="s4 m4 l4">
				<button
					onclick={() => {
						clearPauseTimer();
						sleepTimerStore.set(undefined);
						ui('#pause-timer');
					}}
					class="max surface-container-highest"
					style="width: 100%; padding: 0.75em 0;"
				>
					<i>delete</i>
				</button>
			</div>
		</div>
	</div>
</dialog>
