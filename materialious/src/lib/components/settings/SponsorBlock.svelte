<script lang="ts">
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import { ensureNoTrailingSlash } from '../../misc';
	import {
		sponsorBlockCategoriesStore,
		sponsorBlockDisplayToastStore,
		sponsorBlockSegmentSubmissionsEnabledStore,
		sponsorBlockStore,
		sponsorBlockTimelineStore,
		sponsorBlockUrlStore,
		sponsorBlockUsernameStore
	} from '../../store';
	import ComboBox from '../ComboBox.svelte';
	import { ensureSponsorBlockIdentity, setSponsorBlockUsername } from '$lib/sponsorblock';

	let sponsorBlockInstance = $state(get(sponsorBlockUrlStore));
	let usernameUpdateTimeout: ReturnType<typeof setTimeout> | undefined = $state();

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

	function onSponsorBlockUsernameInput() {
		clearTimeout(usernameUpdateTimeout);

		usernameUpdateTimeout = setTimeout(() => {
			setSponsorBlockUsername($sponsorBlockUsernameStore ?? '').catch((error) => {
				console.error($_('layout.sponsors.failedToSetUsername'), error);
			});
		}, 500);
	}

	$effect(() => {
		if ($sponsorBlockSegmentSubmissionsEnabledStore) {
			ensureSponsorBlockIdentity();
		}
	});

	$effect(() => {
		return () => {
			clearTimeout(usernameUpdateTimeout);
		};
	});
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
		<input bind:checked={$sponsorBlockTimelineStore} type="checkbox" role="switch" />
		<span></span>
	</label>
</nav>

<nav class="no-padding">
	<div class="max">
		<p>{$_('layout.sponsors.enableSegmentSubmissions')}</p>
	</div>
	<label class="switch" tabindex="0">
		<input
			bind:checked={$sponsorBlockSegmentSubmissionsEnabledStore}
			type="checkbox"
			role="switch"
		/>
		<span></span>
	</label>
</nav>

{#if $sponsorBlockSegmentSubmissionsEnabledStore}
	<nav>
		<div class="field label surface-container-highest max">
			<input
				bind:value={$sponsorBlockUsernameStore}
				oninput={onSponsorBlockUsernameInput}
				name="sponsorblock-username"
				type="text"
				placeholder={$_('layout.sponsors.sponsorBlockUsername')}
				autocomplete="off"
				autocapitalize="off"
				autocorrect="off"
				spellcheck="false"
			/>
			<label for="sponsorblock-username">{$_('layout.sponsors.sponsorBlockUsername')}</label>
		</div>
	</nav>
{/if}

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
