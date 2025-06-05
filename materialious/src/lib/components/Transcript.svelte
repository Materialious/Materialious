<script lang="ts">
	import { videoLength } from '$lib/numbers';
	import Fuse from 'fuse.js';
	import { VTTCue, parseText, type ParsedCaptionsResult } from 'media-captions';
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import type { VideoPlay } from '../api/model';
	import { decodeHtmlCharCodes } from '../misc';
	import { instanceStore } from '../store';

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

	export function dedupeAndMergeOverlappingCues(cues: VTTCue[], timeOffset = -1): VTTCue[] {
		const merged: VTTCue[] = [];

		for (const cue of cues) {
			const trimmedText = cue.text.trim();
			if (!trimmedText) {
				continue;
			}

			let wasMerged = false;

			for (let i = 0; i < merged.length; i++) {
				const existing = merged[i];

				const timeGap = Math.abs(cue.startTime - existing.endTime);
				const isTimeAdjacent = timeGap <= 1.5;

				if (isTimeAdjacent && areCuesTextSimilar(existing.text, cue.text)) {
					const mergedText = mergeCueText(existing.text, cue.text);

					const newStart = Math.max(0, Math.min(existing.startTime, cue.startTime) + timeOffset);
					const newEnd = Math.max(existing.endTime, cue.endTime) + timeOffset;

					const mergedCue = new VTTCue(newStart, newEnd, mergedText);
					copyCueMeta(mergedCue, cue);

					merged[i] = mergedCue;
					wasMerged = true;
					break;
				}
			}

			if (!wasMerged) {
				const offsetCue = new VTTCue(
					Math.max(0, cue.startTime + timeOffset),
					cue.endTime + timeOffset,
					cue.text
				);
				copyCueMeta(offsetCue, cue);
				merged.push(offsetCue);
			}
		}

		// Ensure no overlapping cues (each cue ends before the next starts)
		for (let i = 0; i < merged.length - 1; i++) {
			const current = merged[i];
			const next = merged[i + 1];
			if (current.endTime > next.startTime) {
				current.endTime = Math.max(current.startTime, next.startTime - 0.01); // 10ms gap
			}
		}

		return merged;
	}

	function areCuesTextSimilar(a: string, b: string): boolean {
		if (a === b) return true;

		// Normalize and compare overlap ratio
		const cleanA = normalizeText(a);
		const cleanB = normalizeText(b);

		const overlap = getTextOverlap(cleanA, cleanB);
		const minLength = Math.min(cleanA.length, cleanB.length);

		// Consider similar if 50% or more overlap
		return overlap / minLength >= 0.5;
	}

	function getTextOverlap(a: string, b: string): number {
		const maxOverlap = Math.min(a.length, b.length);
		for (let i = maxOverlap; i > 0; i--) {
			if (a.endsWith(b.slice(0, i)) || b.endsWith(a.slice(0, i))) {
				return i;
			}
		}
		return 0;
	}

	function normalizeText(text: string): string {
		return text
			.trim()
			.replace(/\s+/g, ' ')
			.replace(/[.,?!"'”“]/g, '')
			.toLowerCase();
	}

	function mergeCueText(a: string, b: string): string {
		// Avoid duplicating overlap
		const overlapLen = getTextOverlap(a, b);
		if (a.endsWith(b.slice(0, overlapLen))) {
			return a + b.slice(overlapLen);
		}
		if (b.endsWith(a.slice(0, overlapLen))) {
			return b + a.slice(overlapLen);
		}
		return `${a} ${b}`;
	}

	function copyCueMeta(target: VTTCue, source: VTTCue): void {
		target.region = source.region;
		target.vertical = source.vertical;
		target.snapToLines = source.snapToLines;
		target.line = source.line;
		target.lineAlign = source.lineAlign;
		target.position = source.position;
		target.positionAlign = source.positionAlign;
		target.size = source.size;
		target.align = source.align;
		target.style = source.style;
	}

	async function loadTranscript() {
		if (!url) {
			transcript = null;
			return;
		}

		isLoading = true;
		transcript = null;

		const resp = await fetch(`${!video.fallbackPatch ? get(instanceStore) : ''}${url}`);
		transcript = await parseText(await resp.text(), { strict: false });

		transcriptCues = dedupeAndMergeOverlappingCues(transcript.cues);
		isLoading = false;
	}

	function searchTranscript() {
		if (!transcript) return;

		if (search.trim() === '') {
			transcriptCues = dedupeAndMergeOverlappingCues(transcript.cues);
			return;
		}

		const fuse = new Fuse(transcript.cues, {
			keys: ['text']
		});

		const results = fuse.search(search).map((item) => item.item);
		transcriptCues = dedupeAndMergeOverlappingCues(results);
	}
</script>

<article class="scroll no-padding" style="height: 75vh;" id="transcript">
	<article class="no-elevate" style="position: sticky; top: 0; z-index: 3;">
		<h6>{$_('transcript')}</h6>
		<div class="field label suffix border">
			<select bind:value={url} onchange={loadTranscript} name="captions">
				<option selected={true} value={null}>{$_('selectLang')}</option>
				{#each video.captions as caption}
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
				{#each transcriptCues as cue}
					<div
						class="transcript-line"
						id={`transcript-line-${cue.startTime}`}
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
</style>
