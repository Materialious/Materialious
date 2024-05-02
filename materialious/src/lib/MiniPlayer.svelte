<script lang="ts">
	import { goto } from '$app/navigation';
	import { _ } from 'svelte-i18n';
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

		// Fixes volume being muted on mobile.
		if (player.volume === 0) {
			player.volume = 1;
		}
	}
</script>

{#if $miniPlayerSrcStore}
	<nav class="bottom no-padding">
		<article class="surface-variant">
			<div class="flex-container">
				<div style="display: flex;">
					<p class="bold truncate align-right">
						{$miniPlayerSrcStore.video.title}
					</p>
					<button
						on:click={() => miniPlayerSrcStore.set(null)}
						class="circle transparent no-margin"
						style="margin-right: 1em;"
					>
						<i>close</i>
					</button>
				</div>
				<p style="margin-right: .8em;" class="align-right">
					{cleanNumber($miniPlayerSrcStore.video.viewCount)}
					{$_('views')}
				</p>
			</div>
			<video
				crossorigin="anonymous"
				on:click={() => {
					goto(`/watch/${$miniPlayerSrcStore.video.videoId}?time=${currentTime}`);
					miniPlayerSrcStore.set(null);
				}}
				id="video"
				bind:currentTime
				on:loadedmetadata={setTime}
				controls={false}
				autoplay
				src={proxyVideoUrl($miniPlayerSrcStore.video.formatStreams[0].url)}
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
		max-width: 300px;
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

		nav {
			flex-direction: initial;
			background-color: initial;
			justify-content: initial;
			align-items: initial;
		}

		article {
			align-items: start;
			justify-content: space-between;
			width: 100%;
			flex-direction: row;
			padding: 0 !important;
		}

		nav video {
			height: 100%;
			margin-left: 10px;
		}

		.flex-container {
			display: flex;
			flex-direction: column;
			height: 100%;
			align-items: center;
			justify-content: center;
			max-width: 100%;
		}
	}
</style>
