<script lang="ts">
	import { addToast } from '$lib/components/Toast.svelte';
	import { _ } from '$lib/i18n';
	import { createSponsorBlockClient, getOrCreateSponsorBlockUserID } from '$lib/sponsorblock';
	import { type Category, type LocalSegment } from 'sponsorblock-api';

	type DraftSegment = {
		startTime: number;
		endTime: number;
		category?: Category;
	};

	const sponsorCategories: { name: string; category: Category }[] = [
		{ name: $_('layout.sponsors.sponsor'), category: 'sponsor' },
		{ name: $_('layout.sponsors.unpaidSelfPromotion'), category: 'selfpromo' },
		{ name: $_('layout.sponsors.interactionReminder'), category: 'interaction' },
		{ name: $_('layout.sponsors.intermissionIntroAnimation'), category: 'intro' },
		{ name: $_('layout.sponsors.credits'), category: 'outro' },
		{ name: $_('layout.sponsors.preViewRecapHook'), category: 'preview' },
		{ name: $_('layout.sponsors.tangentJokes'), category: 'filler' }
	];

	let menuState: 'root' | 'submission' | 'segment' | 'category' | 'confirm' = $state('root');
	let selectedSegmentIndex: number | undefined = $state(undefined);

	let {
		playerElement,
		videoID,
		onSegmentStart,
		onSegmentStop,
		onSegmentsClear,
		onSegmentDelete,
		onSegmentSelect,
		onSegmentDeselect,
		onSegmentUpdate
	}: {
		playerElement: HTMLMediaElement;
		videoID: string;
		onSegmentStart: (time: number | undefined) => void;
		onSegmentStop: (segment: DraftSegment) => void;
		onSegmentsClear: () => void;
		onSegmentDelete: (index: number) => void;
		onSegmentSelect: (index: number) => void;
		onSegmentDeselect: () => void;
		onSegmentUpdate: (index: number, segment: DraftSegment) => void;
	} = $props();

	let segmentStart: number | undefined = $state(undefined);
	let segments: DraftSegment[] = $state([]);
	let submitError: string | undefined = $state(undefined);

	let isSubmitting = $state(false);
	const isCreatingSegment = $derived(segmentStart !== undefined);
	const allSegmentsDefined = $derived(
		segments.length > 0 && segments.every((segment) => segment.category !== undefined)
	);

	function formatTime(seconds: number) {
		const totalMilliseconds = Math.round(seconds * 1000);
		const hours = Math.floor(totalMilliseconds / 3600000);
		const minutes = Math.floor((totalMilliseconds % 3600000) / 60000);
		const remainingMilliseconds = totalMilliseconds % 60000;
		const remainingSeconds = Math.floor(remainingMilliseconds / 1000);
		const milliseconds = remainingMilliseconds % 1000;
		const formattedMinutes = hours > 0 ? minutes.toString().padStart(2, '0') : minutes;
		const formattedTime = `${formattedMinutes}:${remainingSeconds
			.toString()
			.padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;

		return hours > 0 ? `${hours}:${formattedTime}` : formattedTime;
	}

	function updateSelectedSegment(updater: (segment: DraftSegment) => DraftSegment) {
		if (selectedSegmentIndex === undefined) return;

		const updatedSegment = updater(segments[selectedSegmentIndex]);

		segments = segments.map((segment, index) =>
			index === selectedSegmentIndex ? updatedSegment : segment
		);

		onSegmentUpdate(selectedSegmentIndex, updatedSegment);
	}

	function updateSelectedSegmentStart() {
		updateSelectedSegment((segment) => ({
			...segment,
			startTime: playerElement.currentTime
		}));
	}

	function updateSelectedSegmentEnd() {
		updateSelectedSegment((segment) => ({
			...segment,
			endTime: playerElement.currentTime
		}));
	}

	function openSubmissionMenu() {
		if (segments.length === 0) return;

		menuState = 'submission';
	}

	function openSegmentMenu(index: number) {
		selectedSegmentIndex = index;
		onSegmentSelect(index);
		menuState = 'segment';
	}

	function deleteSelectedSegment() {
		if (selectedSegmentIndex === undefined) return;

		segments = segments.filter((_, index) => index !== selectedSegmentIndex);
		onSegmentDelete(selectedSegmentIndex);
		onSegmentDeselect();

		selectedSegmentIndex = undefined;
		menuState = 'submission';
	}

	function updateSelectedSegmentCategory(category: Category) {
		updateSelectedSegment((segment) => ({
			...segment,
			category
		}));
	}

	async function submitSegments() {
		if (!allSegmentsDefined || isSubmitting) return;

		submitError = undefined;
		isSubmitting = true;

		try {
			const userID = getOrCreateSponsorBlockUserID();
			const sponsorBlock = createSponsorBlockClient(userID);

			const localSegments: LocalSegment[] = segments.map((segment) => {
				if (!segment.category) {
					throw new Error($_('layout.sponsors.allSegmentsNeedCategory'));
				}

				return {
					startTime: Math.min(segment.startTime, segment.endTime),
					endTime: Math.max(segment.startTime, segment.endTime),
					category: segment.category
				};
			});

			await sponsorBlock.postSegments(videoID, ...localSegments);

			segments = [];
			segmentStart = undefined;
			selectedSegmentIndex = undefined;
			onSegmentsClear();
			onSegmentDeselect();

			menuState = 'root';

			addToast({
				data: {
					text: $_('layout.sponsors.segmentsSubmitted')
				}
			});
		} catch (error) {
			submitError =
				error instanceof Error ? error.message : $_('layout.sponsors.failedToSubmitSegments');

			addToast({
				data: {
					text: submitError
				}
			});
		} finally {
			isSubmitting = false;
		}
	}

	function startSegment() {
		segmentStart = playerElement.currentTime;
		onSegmentStart(segmentStart);
	}

	function cancelSegmentCreation() {
		const start = segmentStart;

		segmentStart = undefined;
		onSegmentStart(undefined);

		if (start !== undefined) {
			addToast({
				data: {
					text: $_('layout.sponsors.cancelledSegment', {
						time: formatTime(start)
					})
				}
			});
		}
	}

	function stopSegment() {
		if (segmentStart === undefined) return;

		const segment: DraftSegment = {
			startTime: segmentStart,
			endTime: playerElement.currentTime
		};

		segments = [...segments, segment];
		onSegmentStop(segment);

		segmentStart = undefined;
	}

	function clearSegments() {
		segments = [];
		segmentStart = undefined;
		selectedSegmentIndex = undefined;

		onSegmentsClear();
		onSegmentDeselect();
	}

	function previewSegment(index: number) {
		const segment = segments[index];

		if (!segment) return;

		selectedSegmentIndex = index;
		onSegmentSelect(index);
		playerElement.currentTime = segment.startTime;
	}
</script>

<button class="surface-container-highest">
	<i>block</i>

	<menu class="no-wrap mobile player-settings">
		{#if menuState === 'submission'}
			<li role="presentation" onclick={() => (menuState = 'root')}>
				<i>arrow_back</i>
				{$_('layout.sponsors.back')}
			</li>

			<li
				role="presentation"
				class:disabled={!allSegmentsDefined || isSubmitting}
				onclick={(event) => {
					event.preventDefault();
					event.stopPropagation();

					if (allSegmentsDefined && !isSubmitting) {
						menuState = 'confirm';
					}
				}}
			>
				<nav class="no-wrap" style="width: 100%;">
					<i>{isSubmitting ? 'hourglass_empty' : 'send'}</i>
					{isSubmitting ? $_('layout.sponsors.submitting') : $_('layout.sponsors.submit')}
				</nav>
			</li>

			{#each segments as segment, index (segment)}
				<li role="presentation" onclick={() => openSegmentMenu(index)}>
					<nav class="no-wrap" style="width: 100%;">
						{#if !segment.category}
							<i>error</i>
						{/if}

						<span>
							{$_('layout.sponsors.segmentLabel', {
								index: index + 1
							})}
						</span>

						<div class="max"></div>

						<span class="chip">
							{#if segment.category}
								{sponsorCategories.find(
									(sponsorCategory) => sponsorCategory.category === segment.category
								)?.name}
							{:else}
								{$_('layout.sponsors.noCategorySelected')}
							{/if}
						</span>
					</nav>
				</li>
			{/each}
		{:else if menuState === 'confirm'}
			<li
				role="presentation"
				onclick={() => {
					onSegmentDeselect();
					selectedSegmentIndex = undefined;
					menuState = 'submission';
				}}
			>
				<i>arrow_back</i>
				{$_('layout.sponsors.back')}
			</li>

			{#each segments as segment, index (segment)}
				<li role="presentation" onclick={() => previewSegment(index)}>
					<nav class="no-wrap" style="width: 100%;">
						<span>
							{$_('layout.sponsors.segmentTimeRange', {
								start: formatTime(segment.startTime),
								end: formatTime(segment.endTime)
							})}
						</span>

						<div class="max"></div>

						<span class="chip">
							{sponsorCategories.find(
								(sponsorCategory) => sponsorCategory.category === segment.category
							)?.name}
						</span>
					</nav>
				</li>
			{/each}

			<li
				role="presentation"
				class:disabled={isSubmitting}
				onclick={(event) => {
					event.preventDefault();
					event.stopPropagation();

					if (!isSubmitting) {
						submitSegments();
					}
				}}
			>
				<nav class="no-wrap" style="width: 100%;">
					<i>{isSubmitting ? 'hourglass_empty' : 'check'}</i>
					{isSubmitting ? $_('layout.sponsors.submitting') : $_('layout.sponsors.confirmSubmit')}
				</nav>
			</li>
		{:else if menuState === 'segment' && selectedSegmentIndex !== undefined}
			<li
				role="presentation"
				onclick={() => {
					onSegmentDeselect();
					selectedSegmentIndex = undefined;
					menuState = 'submission';
				}}
			>
				<i>arrow_back</i>
				{$_('layout.sponsors.back')}
			</li>

			<li role="presentation" onclick={() => (menuState = 'category')}>
				<nav class="no-wrap" style="width: 100%;">
					<i>category</i>
					{$_('layout.sponsors.chooseCategory')}
				</nav>
			</li>

			<li role="presentation" onclick={updateSelectedSegmentStart}>
				<nav class="no-wrap" style="width: 100%;">
					<i>play_arrow</i>
					{$_('layout.sponsors.setSegmentStart')}

					<div class="max"></div>

					<span class="chip">
						{formatTime(segments[selectedSegmentIndex].startTime)}
					</span>
				</nav>
			</li>

			<li role="presentation" onclick={updateSelectedSegmentEnd}>
				<nav class="no-wrap" style="width: 100%;">
					<i>stop</i>
					{$_('layout.sponsors.setSegmentEnd')}

					<div class="max"></div>

					<span class="chip">
						{formatTime(segments[selectedSegmentIndex].endTime)}
					</span>
				</nav>
			</li>

			<li role="presentation" onclick={deleteSelectedSegment}>
				<nav class="no-wrap" style="width: 100%;">
					<i>delete</i>
					{$_('delete')}
				</nav>
			</li>
		{:else if menuState === 'category' && selectedSegmentIndex !== undefined}
			<li role="presentation" onclick={() => (menuState = 'segment')}>
				<i>arrow_back</i>
				{$_('layout.sponsors.back')}
			</li>

			{#each sponsorCategories as sponsorCategory (sponsorCategory.category)}
				<li
					role="presentation"
					onclick={() => {
						updateSelectedSegmentCategory(sponsorCategory.category);
						menuState = 'segment';
					}}
				>
					<nav class="no-wrap" style="width: 100%;">
						{sponsorCategory.name}
					</nav>
				</li>
			{/each}
		{:else}
			<li
				role="presentation"
				class:disabled={segments.length === 0}
				onclick={() => {
					if (segments.length > 0) {
						openSubmissionMenu();
					}
				}}
			>
				<nav class="no-wrap" style="width: 100%;">
					<i>send</i>
					{$_('layout.sponsors.openSubmissionMenu')}

					<div class="max"></div>

					<span class="chip">
						{segments.length}
					</span>
				</nav>
			</li>

			<li
				role="presentation"
				class:disabled={segments.length === 0}
				onclick={() => {
					if (segments.length > 0) {
						clearSegments();
					}
				}}
			>
				<nav class="no-wrap" style="width: 100%;">
					<i>delete</i>
					{$_('layout.sponsors.clearSegments')}

					<div class="max"></div>
				</nav>
			</li>

			<li
				role="presentation"
				class:disabled={!isCreatingSegment}
				onclick={() => {
					if (isCreatingSegment) {
						cancelSegmentCreation();
					}
				}}
			>
				<nav class="no-wrap" style="width: 100%;">
					<i>cancel</i>
					{$_('layout.sponsors.cancelSegmentCreation')}
				</nav>
			</li>

			{#if isCreatingSegment}
				<li role="presentation" onclick={stopSegment}>
					<nav class="no-wrap" style="width: 100%;">
						<i>stop</i>
						{$_('layout.sponsors.stopSegmentNow')}

						<div class="max"></div>

						<span class="chip">
							{formatTime(segmentStart ?? 0)}
						</span>
					</nav>
				</li>
			{:else}
				<li role="presentation" onclick={startSegment}>
					<nav class="no-wrap" style="width: 100%;">
						<i>play_arrow</i>
						{$_('layout.sponsors.startSegmentNow')}
					</nav>
				</li>
			{/if}
		{/if}
	</menu>
</button>

<style>
	.disabled {
		opacity: 0.5;
		pointer-events: none;
	}
</style>
