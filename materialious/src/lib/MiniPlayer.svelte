<script lang="ts">
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import { proxyVideoUrl } from './misc';
	import { miniPlayerSrcStore, playerProxyVideosStore } from './store';

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

		// Fixes volume being muted on mobile.
		if (player.volume === 0) {
			player.volume = 1;
		}
	}
</script>

{#if $miniPlayerSrcStore && $miniPlayerSrcStore.video.formatStreams.length > 0}
	<nav class="bottom no-padding">
		<article class="surface-bright">
			<button on:click={() => miniPlayerSrcStore.set(null)} class="s circle transparent no-margin">
				<i>close</i>
			</button>
			<div class="flex-container">
				<div style="display: flex;">
					<p class="bold truncate">
						{$miniPlayerSrcStore.video.title}
					</p>
					<button
						on:click={() => miniPlayerSrcStore.set(null)}
						class="m l circle transparent no-margin"
					>
						<i>close</i>
					</button>
				</div>
				<progress class="s" value={currentTime} max={$miniPlayerSrcStore.video.lengthSeconds}
				></progress>
			</div>
			<video
				on:click={() => {
					goto(`/watch/${$miniPlayerSrcStore.video.videoId}?time=${currentTime}`);
					miniPlayerSrcStore.set(null);
				}}
				id="video"
				style="cursor: pointer;"
				bind:currentTime
				on:loadedmetadata={setTime}
				controls={false}
				autoplay
				src={get(playerProxyVideosStore)
					? proxyVideoUrl($miniPlayerSrcStore.video.formatStreams[0].url)
					: $miniPlayerSrcStore.video.formatStreams[0].url}
			>
			</video>
		</article>
	</nav>
{/if}

<style>
	nav {
		display: flex;
		background-color: transparent;
		justify-content: end;
		align-items: flex-end;
	}

	article {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}

	nav video {
		height: 180px;
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
		max-width: 270px;
	}

	@media screen and (max-width: 590px) {
		nav.bottom {
			bottom: 100px !important;
		}

		nav {
			flex-direction: initial;
			background-color: initial;
			justify-content: initial;
			align-items: initial;
		}

		article {
			align-items: start;
			width: 100%;
			flex-direction: row;
			padding: 0 !important;
			justify-content: center;
		}

		nav video {
			height: 100%;
			margin-left: 10px;
		}

		.flex-container {
			max-width: 100%;
		}
	}
</style>
