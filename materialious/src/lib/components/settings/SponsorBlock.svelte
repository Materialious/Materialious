<script lang="ts">
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import { ensureNoTrailingSlash } from '../../misc';
	import {
		sponsorBlockCategoriesStore,
		sponsorBlockDisplayToastStore,
		sponsorBlockStore,
		sponsorBlockTimelineStore,
		sponsorBlockUrlStore
	} from '../../store';
	import ComboBox from '../ComboBox.svelte';

	let sponsorBlockInstance = $state(get(sponsorBlockUrlStore));

	const sponsorCategories = [
		{ name: $_('layout.sponsors.sponsor'), category: 'sponsor' },
		{ name: $_('layout.sponsors.unpaidSelfPromotion'), category: 'selfpromo' },
		{ name: $_('layout.sponsors.interactionReminder'), category: 'interaction' },
		{ name: $_('layout.sponsors.intermissionIntroAnimation'), category: 'intro' },
		{ name: $_('layout.sponsors.credits'), category: 'outro' },
		{ name: $_('layout.sponsors.preViewRecapHook'), category: 'preview' },
		{ name: $_('layout.sponsors.tangentJokes'), category: 'filler' }
	];

	function onSponsorSet(category: string, givenValue: string) {
		const value = givenValue as 'automatic' | 'manual' | 'timeline' | 'disabled';

		const categories = get(sponsorBlockCategoriesStore);

		if (value !== 'disabled') {
			categories[category] = value;
		} else {
			delete categories[category];
		}

		sponsorBlockCategoriesStore.set(categories);
	}
</script>

<form
	onsubmit={(event: Event) => {
		event.preventDefault();
		sponsorBlockUrlStore.set(ensureNoTrailingSlash(sponsorBlockInstance));
	}}
>
	<nav>
		<div class="field prefix label surface-container-highest max">
			<i>link</i>
			<input
				tabindex="0"
				bind:value={sponsorBlockInstance}
				name="sponsorblock-instance"
				type="text"
			/>
			<label tabindex="-1" for="sponsorblock-instance">{$_('layout.instanceUrl')}</label>
		</div>
		<button class="circle">
			<i>done</i>
		</button>
	</nav>
</form>

<nav class="no-padding">
	<div class="max">
		<p>{$_('enabled')}</p>
	</div>
	<label class="switch" tabindex="0">
		<input
			bind:checked={$sponsorBlockStore}
			onclick={() => sponsorBlockStore.set(!$sponsorBlockStore)}
			type="checkbox"
			role="switch"
		/>
		<span></span>
	</label>
</nav>

<nav class="no-padding">
	<div class="max">
		<p>{$_('layout.sponsors.disableToast')}</p>
	</div>
	<label class="switch" tabindex="0">
		<input
			bind:checked={$sponsorBlockDisplayToastStore}
			onclick={() => sponsorBlockDisplayToastStore.set(!$sponsorBlockDisplayToastStore)}
			type="checkbox"
			role="switch"
		/>
		<span></span>
	</label>
</nav>

<nav class="no-padding">
	<div class="max">
		<p>{$_('layout.sponsors.disableTimeline')}</p>
	</div>
	<label class="switch">
		<input
			bind:checked={$sponsorBlockTimelineStore}
			onclick={() => sponsorBlockTimelineStore.set(!$sponsorBlockTimelineStore)}
			type="checkbox"
		/>
		<span></span>
	</label>
</nav>

<hr style="margin: 1em 0;" />

<p class="bold">{$_('layout.sponsors.Catagories')}</p>

{#each sponsorCategories as sponsor (sponsor)}
	{@const currentCategoryTrigger = $sponsorBlockCategoriesStore[sponsor.category]}

	<div class="field middle-align">
		<nav class="no-padding combobox">
			<div class="max">
				<p>{sponsor.name}</p>
			</div>
			<ComboBox
				options={[
					{ label: $_('disabled'), value: 'disabled' },
					{ label: $_('layout.sponsors.automatic'), value: 'automatic' },
					{ label: $_('layout.sponsors.manual'), value: 'manual' },
					{ label: $_('layout.sponsors.timeline'), value: 'timeline' }
				]}
				defaultValue={currentCategoryTrigger ?? 'disabled'}
				onChange={(value) => onSponsorSet(sponsor.category, value)}
			/>
		</nav>
	</div>
{/each}

<style>
	@media screen and (max-width: 640px) {
		nav.combobox {
			flex-direction: column;
			align-items: start;
		}
	}
</style>
