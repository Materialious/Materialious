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
		<nav class="no-space">
			<button style="cursor: default;" class="border left-round">
				<i class="small">thumb_up</i>
				<span>{cleanNumber(returnYTDislikes.likes)}</span>
			</button>
			<button style="cursor: default;margin-right: 0.5em;" class="border right-round">
				<i class="small">thumb_down_alt</i>
				<span>{cleanNumber(returnYTDislikes.dislikes)}</span>
			</button>
		</nav>
	{:else}
		<button style="cursor: default;margin-right: 0.5em;" class="border">
			<i class="small">thumb_up</i>
			<span>{cleanNumber(video.likeCount)}</span>
		</button>
	{/if}
{/await}
