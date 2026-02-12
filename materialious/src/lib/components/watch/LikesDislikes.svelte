<script lang="ts">
	import type { ReturnYTDislikes, VideoPlay } from '$lib/api/model';
	import { cleanNumber } from '$lib/numbers';

	let {
		video,
		returnYTDislikes
	}: { video: VideoPlay; returnYTDislikes?: Promise<ReturnYTDislikes> | null } = $props();
</script>

{#await returnYTDislikes then returnYTDislikes}
	{#if returnYTDislikes}
		<button style="cursor: default;margin-left: 0;" class="surface-container-highest">
			<i class="small">thumb_up</i>
			<span>{cleanNumber(returnYTDislikes.likes)}</span>
			<i class="small" style="margin-left: 0.5em;">thumb_down_alt</i>
			<span>{cleanNumber(returnYTDislikes.dislikes)}</span>
		</button>
	{:else}
		<button style="cursor: default;margin-left: 0;" class="surface-container-highest">
			<i class="small">thumb_up</i>
			<span>{cleanNumber(video.likeCount)}</span>
		</button>
	{/if}
{/await}
