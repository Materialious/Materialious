<script lang="ts">
	import { onMount } from 'svelte';

	let { playerElement }: { playerElement: HTMLMediaElement } = $props();

	function hasWebkitShowPlaybackTargetPicker(
		el: HTMLMediaElement
	): el is HTMLMediaElement & { webkitShowPlaybackTargetPicker: () => void } {
		return typeof (el as any).webkitShowPlaybackTargetPicker === 'function';
	}

	function handleAirPlayClick() {
		if (playerElement && hasWebkitShowPlaybackTargetPicker(playerElement)) {
			playerElement.webkitShowPlaybackTargetPicker();
		}
	}

	onMount(() => {
		if (playerElement.hasAttribute('x-webkit-airplay')) return;

		if (hasWebkitShowPlaybackTargetPicker(playerElement)) {
			playerElement.setAttribute('x-webkit-airplay', 'allow');
		}
	});
</script>

{#if playerElement && hasWebkitShowPlaybackTargetPicker(playerElement)}
	<button class="surface-container-highest" onclick={handleAirPlayClick} title="AirPlay">
		<i>airplay</i>
	</button>
{/if}
