<script lang="ts">
	import { videoLength } from '$lib/numbers';
	import Fuse from 'fuse.js';
	import { type VTTCue, parseText, type ParsedCaptionsResult } from 'media-captions';
	import { _ } from '$lib/i18n';
	import type { VideoPlay } from '../api/model';
	import { decodeHtmlCharCodes } from '../misc';
	import { invidiousInstanceStore } from '../store';

	interface Props {
		video: VideoPlay;
		playerElement: HTMLMediaElement;
	}

	let { video, playerElement = $bindable() }: Props = $props();

	let url: string | null = $state(null);
	let autoScroll: boolean = $state(true);

	let transcript: ParsedCaptionsResult | null = $state(null);
	let transcriptCues: VTTCue[] = $state([]);
	let isLoading = $state(false);
	let currentTime = $state(0);
	let search: string = $state('');

	playerElement.addEventListener('timeupdate', () => {
		currentTime = playerElement.currentTime;

		if (autoScroll) {
			const currentTranscriptLine = document.querySelector(
				'.transcript-line.secondary-container'
			) as HTMLElement;
			const transcriptScrollable = document.getElementById('transcript');

			if (currentTranscriptLine && transcriptScrollable) {
				transcriptScrollable.scrollTop =
					currentTranscriptLine.offsetTop - transcriptScrollable.offsetTop - 300;
			}
		}
	});

	async function loadTranscript() {
		if (!url) {
			transcript = null;
			return;
		}

		let urlConstructed = '';

		if (video.fallbackPatch === 'youtubejs') {
			urlConstructed = url;
		} else if ($invidiousInstanceStore) {
			urlConstructed = new URL($invidiousInstanceStore).origin + url;
		} else {
			return;
		}

		isLoading = true;
		transcript = null;
		const resp = await fetch(urlConstructed);
		transcript = await parseText(await resp.text(), { strict: false });
		transcriptCues = transcript.cues;

		isLoading = false;
	}

	function searchTranscript() {
		if (!transcript) return;

		if (search.trim() === '') {
			transcriptCues = transcript.cues;
			return;
		}

		const fuse = new Fuse(transcript.cues, {
			keys: ['text']
		});

		transcriptCues = fuse.search(search).map((item) => item.item);
	}
</script>

<article class="scroll border no-padding" style="height: 75vh;" id="transcript">
	<article class="no-elevate padding" style="position: sticky; top: 0; z-index: 3;">
		<h6>{$_('transcript')}</h6>
		<div class="field label suffix border">
			<select bind:value={url} onchange={loadTranscript} name="captions">
				<option selected={true} value={null}>{$_('selectLang')}</option>
				{#each video.captions as caption (caption)}
					<option value={caption.url}>{caption.label}</option>
				{/each}
			</select>
			<label for="captions">{$_('language')}</label>
			<i>arrow_drop_down</i>
		</div>
		{#if transcriptCues.length > 0}
			<div class="max field round suffix prefix small no-margin surface-variant">
				<i class="front">search</i><input
					bind:value={search}
					oninput={searchTranscript}
					type="text"
					placeholder={$_('searchPlaceholder')}
				/>
			</div>
			<div class="space"></div>
			<label class="checkbox">
				<input bind:checked={autoScroll} type="checkbox" />
				<span>Auto scroll</span>
			</label>
		{/if}
		<div class="space"></div>
		<div class="divider"></div>
	</article>

	{#if isLoading}
		<nav class="center-align">
			<progress class="circle"></progress>
		</nav>
	{:else if transcript}
		{#if transcript.cues.length > 0}
			{#if transcriptCues.length > 0}
				{#each transcriptCues as cue (cue)}
					<div
						class="transcript-line"
						role="presentation"
						onclick={() => (playerElement.currentTime = cue.startTime)}
						class:secondary-container={currentTime >= cue.startTime && currentTime <= cue.endTime}
					>
						<p class="chip no-margin">{videoLength(cue.startTime)}</p>
						<p class="transcript-text">{decodeHtmlCharCodes(cue.text.replace(/<[^>]+>/g, ''))}</p>
					</div>
				{/each}
			{:else}
				<nav class="center-align">
					<h6>{$_('noResult')}</h6>
				</nav>
			{/if}
		{:else}
			<nav class="center-align">
				<h6>{$_('noCaptionData')}</h6>
			</nav>
		{/if}
	{/if}
</article>

<style>
	.transcript-line {
		display: flex;
		cursor: pointer;
		align-items: center;
		padding: 0.5em;
		margin: 1em;
	}

	.transcript-text {
		margin-left: 1em;
	}

	.transcript-line .chip {
		padding: 0 1.5em;
	}
</style>
