<script lang="ts">
	import { _ } from '$lib/i18n';
	import type shaka from 'shaka-player/dist/shaka-player.ui';
	import { SvelteSet } from 'svelte/reactivity';
	import ISO6391 from 'iso-639-1';
	import { playerAlwaysLoopStore } from '$lib/store';
	import { playbackRates } from '$lib/player/index';
	import { onMount } from 'svelte';

	let { player, playerElement }: { player: shaka.Player; playerElement: HTMLMediaElement } =
		$props();

	let playerSettings: 'quality' | 'speed' | 'language' | 'root' = $state('root');
	let playerCurrentVideoTrack: shaka.extern.VideoTrack | undefined = $state(undefined);
	let playerCurrentAudioTrack: shaka.extern.AudioTrack | undefined = $state(undefined);
	let playerLoop = $state($playerAlwaysLoopStore);

	onMount(() => {
		player.addEventListener('loaded', () => {
			setActiveVideoTrack();
			setActiveAudioTrack();
		});

		player.addEventListener('trackschanged', () => {
			setActiveVideoTrack();
			setActiveAudioTrack();
		});
	});

	function setActiveVideoTrack() {
		const videoTracks = player.getVideoTracks();
		playerCurrentVideoTrack = videoTracks.find((track) => track.active);
	}

	function setActiveAudioTrack() {
		const audioTracks = player.getAudioTracks();
		playerCurrentAudioTrack = audioTracks.find((track) => track.active);
	}

	function filterUniqueAudioTracks(tracks: shaka.extern.AudioTrack[]): shaka.extern.AudioTrack[] {
		const uniqueTracks: shaka.extern.AudioTrack[] = [];
		const seen = new SvelteSet<string>();

		for (const track of tracks) {
			const identifier = `${track.language}-${track.label || 'No Label'}`;
			if (!seen.has(identifier)) {
				seen.add(identifier);
				uniqueTracks.push(track);
			}
		}

		return uniqueTracks;
	}
</script>

<button class="surface-container-highest">
	<i>settings</i>
	<menu class="no-wrap mobile player-settings">
		{#if playerSettings !== 'root'}
			<li role="presentation" onclick={() => (playerSettings = 'root')}>
				<i>arrow_back</i>
				{$_('player.controls.back')}
			</li>
		{/if}
		{#if playerSettings === 'root'}
			<li role="presentation" onclick={() => (playerSettings = 'quality')}>
				<nav class="no-wrap" style="width: 100%;">
					<i>high_quality</i>
					{$_('player.controls.quality')}

					<div class="max"></div>

					<span class="chip">
						{#if playerCurrentVideoTrack}
							{playerCurrentVideoTrack.height}p
						{:else}
							{$_('player.controls.auto')}
						{/if}
					</span>
				</nav>
			</li>
			<li role="presentation" onclick={() => (playerSettings = 'speed')}>
				<nav class="no-wrap" style="width: 100%;">
					<i>speed</i>
					{$_('player.controls.playbackSpeed')}

					<div class="max"></div>

					<span class="chip">
						{playerElement?.playbackRate}x
					</span>
				</nav>
			</li>
			{#if playerCurrentAudioTrack && playerCurrentAudioTrack.label !== null}
				<li role="presentation" onclick={() => (playerSettings = 'language')}>
					<nav class="no-wrap" style="width: 100%;">
						<i>language</i>
						{$_('player.controls.language')}

						<div class="max"></div>

						<span class="chip">
							{#if playerCurrentAudioTrack}
								{playerCurrentAudioTrack.language !== 'und'
									? ISO6391.getName(playerCurrentAudioTrack.language)
									: playerCurrentAudioTrack.label}
							{/if}
						</span>
					</nav>
				</li>
			{/if}
			<li
				role="presentation"
				onclick={() => {
					if (playerElement) playerElement.loop = !playerLoop;
					playerLoop = !playerLoop;
				}}
			>
				<nav class="no-wrap" style="width: 100%;">
					<i>all_inclusive</i>
					{$_('player.controls.loop')}

					<div class="max"></div>

					<span class="chip">
						{playerLoop ? $_('player.controls.on') : $_('player.controls.off')}
					</span>
				</nav>
			</li>
		{:else if playerSettings === 'quality'}
			<li
				role="presentation"
				onclick={() => {
					playerSettings = 'root';
					player.configure({ abr: true });
					playerCurrentVideoTrack = undefined;
				}}
			>
				{$_('player.controls.auto')}
			</li>
			{#each player.getVideoTracks().sort((a, b) => {
				const heightA = a.height || 0;
				const heightB = b.height || 0;
				const widthA = a.width || 0;
				const widthB = b.width || 0;
				return heightB - heightA || widthB - widthA;
			}) as track (track)}
				<li
					role="presentation"
					onclick={() => {
						playerSettings = 'root';
						player.selectVideoTrack(track, true);
						setActiveVideoTrack();
					}}
				>
					{track.height}p
				</li>
			{/each}
		{:else if playerSettings === 'speed'}
			{#each playbackRates as playbackRate (playbackRate)}
				<li
					role="presentation"
					onclick={() => {
						playerSettings = 'root';
						if (playerElement) playerElement.playbackRate = playbackRate;
					}}
				>
					{playbackRate}
				</li>
			{/each}
		{:else if playerSettings === 'language'}
			{#each filterUniqueAudioTracks(player.getAudioTracks()) as track (track)}
				<li
					role="presentation"
					onclick={() => {
						playerSettings = 'root';
						player.selectAudioTrack(track);
						setActiveAudioTrack();
					}}
				>
					{#if track.language !== 'und'}
						{ISO6391.getName(track.language)} -
					{/if}
					{track.label}
				</li>
			{/each}
		{/if}
	</menu>
</button>
