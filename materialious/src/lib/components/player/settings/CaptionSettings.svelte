<script lang="ts">
	import type shaka from 'shaka-player/dist/shaka-player.ui';
	import { onMount } from 'svelte';
	import { _ } from '$lib/i18n';
	import type { VideoPlay } from '$lib/api/model';

	let { player, video }: { player: shaka.Player; video: VideoPlay } = $props();

	let playerTextTracks: shaka.extern.TextTrack[] | undefined = $state(undefined);

	onMount(() => {
		playerTextTracks = player.getTextTracks();
	});
</script>

{#if playerTextTracks && playerTextTracks.length > 0 && !video.liveNow}
	<button class="surface-container-highest">
		<i>closed_caption</i>
		<menu class="no-wrap mobile" id="cc-menu" data-ui="#cc-menu">
			<li
				role="presentation"
				data-ui="#cc-menu"
				onclick={() => player.setTextTrackVisibility(false)}
			>
				{$_('player.controls.off')}
			</li>
			{#each playerTextTracks as track (track)}
				<li
					role="presentation"
					data-ui="#cc-menu"
					onclick={() => {
						player.selectTextTrack(track);
						player.setTextTrackVisibility(true);
					}}
				>
					{track.label}
				</li>
			{/each}
		</menu>
	</button>
{/if}
