<script lang="ts">
	import { _ } from '$lib/i18n';
	import type { VideoPlay } from '$lib/api/model';
	import { selectTextTrack, setTextTrackVisibility } from '../ClosedCaptions.svelte';

	let { video }: { video: VideoPlay } = $props();
</script>

{#if video.captions.length > 0 && !video.liveNow}
	<button class="surface-container-highest">
		<i>closed_caption</i>
		<menu class="no-wrap mobile player-settings" id="cc-menu" data-ui="#cc-menu">
			<li role="presentation" data-ui="#cc-menu" onclick={() => setTextTrackVisibility(false)}>
				{$_('player.controls.off')}
			</li>
			{#each video.captions as track (track)}
				<li
					role="presentation"
					data-ui="#cc-menu"
					onclick={() => {
						selectTextTrack(track.language_code);
						setTextTrackVisibility(true);
					}}
				>
					{track.label}
				</li>
			{/each}
		</menu>
	</button>
{/if}
