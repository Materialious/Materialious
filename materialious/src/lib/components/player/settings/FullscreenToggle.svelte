<script lang="ts">
	let {
		playerIsFullscreen,
		toggleFullscreen
	}: { playerIsFullscreen: boolean; toggleFullscreen: () => void } = $props();
</script>

<button class="surface-container-highest" onclick={toggleFullscreen}>
	<i>
		{#if playerIsFullscreen}
			fullscreen_exit
		{:else}
			fullscreen
		{/if}
	</i>
</button>
