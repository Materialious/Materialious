<script lang="ts">
	let { playerElement }: { playerElement: HTMLMediaElement | undefined } = $props();

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

	$effect(() => {
		if (!playerElement || playerElement.hasAttribute('x-webkit-airplay')) return;

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
