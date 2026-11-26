<script lang="ts">
	import { _, locale } from '#lib/i18n/index';
	import { videoLength } from '#lib/numbers';
	import { sleepTimerShakeToReset, sleepTimerVibrateBeforeEnd } from '#lib/stores/player';
	import { padTime } from '#lib/time';

	const maxDefaultSeconds = 15 * 60;
	const quickMinutes = [5, 10, 30];
	const presetMinutes = [...quickMinutes, 60, 120];

	let {
		dialog = $bindable(),
		showAndroidOptions,
		videoDuration,
		pauseTimerRemaining,
		addPauseTimer,
		disablePauseTimer
	}: {
		dialog?: HTMLDialogElement;
		showAndroidOptions: boolean;
		videoDuration: number;
		pauseTimerRemaining: number;
		addPauseTimer: (seconds: number) => void;
		disablePauseTimer: () => void;
	} = $props();

	let primaryButton: HTMLButtonElement;
	const active = $derived(pauseTimerRemaining > 0);
	const defaultSeconds = $derived(
		Math.max(1, Math.round(Math.min(videoDuration / 2, maxDefaultSeconds)))
	);
	const countdown = $derived(padTime(videoLength(active ? pauseTimerRemaining : defaultSeconds)));

	function formatPreset(minutes: number) {
		const hours = minutes >= 60;
		return new Intl.NumberFormat($locale, {
			style: 'unit',
			unit: hours ? 'hour' : 'minute',
			unitDisplay: 'short'
		}).format(hours ? minutes / 60 : minutes);
	}

	function choosePreset(minutes: number) {
		addPauseTimer(minutes * 60);
		if (minutes >= 60) primaryButton.focus();
	}
</script>

<dialog
	id="pause-timer"
	bind:this={dialog}
	class="padding"
	aria-labelledby="pause-timer-title"
	closedby="any"
>
	<nav class="no-space">
		<h6 id="pause-timer-title" class="max">{$_('player.pauseTimer')}</h6>
		<button
			type="button"
			class="circle surface-container-highest"
			aria-label={$_('player.pauseTimerClose')}
			onclick={() => dialog?.close()}
		>
			<i aria-hidden="true">close</i>
		</button>
	</nav>

	<p class="countdown center-align no-margin" role="timer">{countdown}</p>

	<div class="space"></div>

	<div class="grid small-space">
		{#each active ? quickMinutes : presetMinutes as minutes (minutes)}
			<div class={minutes < 60 ? 's4 m4 l4' : 's6 m6 l6'}>
				<button
					type="button"
					class="round responsive small-padding surface-container-highest"
					onclick={() => choosePreset(minutes)}
				>
					{active
						? $_('player.pauseTimerAddTime', { time: formatPreset(minutes) })
						: formatPreset(minutes)}
				</button>
			</div>
		{/each}
	</div>

	<div class="small-space"></div>

	<button
		bind:this={primaryButton}
		type="button"
		class="round responsive surface-container-highest bold"
		onclick={() => (active ? disablePauseTimer() : addPauseTimer(defaultSeconds))}
	>
		{$_(active ? 'player.pauseTimerDisable' : 'player.pauseTimerStart')}
	</button>

	{#if showAndroidOptions}
		<div class="space"></div>
		<div class="row vertical small-space">
			<label class="checkbox">
				<input type="checkbox" bind:checked={$sleepTimerShakeToReset} />
				<span>{$_('player.pauseTimerShakeToReset')}</span>
			</label>
			<label class="checkbox">
				<input type="checkbox" bind:checked={$sleepTimerVibrateBeforeEnd} />
				<span>{$_('player.pauseTimerVibrateBeforeEnd')}</span>
			</label>
		</div>
	{/if}
</dialog>

<style>
	dialog {
		inline-size: min(26rem, calc(100% - 1rem));
		min-inline-size: 0;
	}

	dialog[open]::backdrop {
		opacity: 1;
		visibility: visible;
	}

	.countdown {
		font-size: 2.75rem;
		font-variant-numeric: tabular-nums;
		line-height: 1.25;
	}

	.checkbox {
		white-space: normal;
	}

	.checkbox input {
		flex-shrink: 0;
	}
</style>
