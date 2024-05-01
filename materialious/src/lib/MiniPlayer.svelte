<script lang="ts">
	import { goto } from '$app/navigation';
	import { miniPlayerSrcStore } from '../store';
	import { cleanNumber, proxyVideoUrl } from './misc';

	let currentTime: number = 0;

	function setTime() {
		const player = (document.getElementById('video') as HTMLVideoElement) || null;
		if (player && $miniPlayerSrcStore) {
			try {
				const vidstackDetails = localStorage.getItem('video-player');
				if (vidstackDetails) {
					const vidstackDetailsParsed = JSON.parse(vidstackDetails);
					if ('volume' in vidstackDetailsParsed) player.volume = vidstackDetailsParsed.volume;
				}
			} catch {}

			player.currentTime = $miniPlayerSrcStore.time;
		}
	}
</script>

{#if $miniPlayerSrcStore}
	<nav class="bottom right-align no-padding">
		<div class="flex-container">
			<p class="bold truncate align-right">
				{$miniPlayerSrcStore.video.title}
			</p>
			<p class="align-right">{cleanNumber($miniPlayerSrcStore.video.viewCount)}</p>
		</div>
		<video
			crossorigin="anonymous"
			on:click={() => {
				goto(`/watch/${$miniPlayerSrcStore.video.videoId}?time=${currentTime}`);
				miniPlayerSrcStore.set(null);
			}}
			id="video"
			volume="1"
			bind:currentTime
			on:loadedmetadata={setTime}
			controls={false}
			autoplay
			src={proxyVideoUrl($miniPlayerSrcStore.video.formatStreams[0].url)}
		>
		</video>
		<button
			on:click={() => miniPlayerSrcStore.set(null)}
			class="circle transparent"
			style="margin-right: 1em;"
		>
			<i>close</i>
		</button>
	</nav>
{/if}

<style>
	nav {
		display: flex;
		align-items: center;
	}

	nav video {
		height: 100%;
		width: auto;
	}

	.flex-container {
		flex: 1;
		overflow: hidden;
	}

	.truncate {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.align-right {
		text-align: right;
	}

	@media screen and (max-width: 590px) {
		nav.bottom {
			bottom: 100px !important;
		}
	}
</style>
