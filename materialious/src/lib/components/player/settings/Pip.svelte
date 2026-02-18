<script lang="ts">
	let { playerElement }: { playerElement: HTMLMediaElement } = $props();
</script>

{#if document.pictureInPictureEnabled}
	<button
		class="surface-container-highest"
		onclick={() => {
			(playerElement as HTMLVideoElement).requestPictureInPicture();
		}}
	>
		<i>pip</i>
	</button>
{/if}
