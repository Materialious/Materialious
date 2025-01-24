<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import { ensureNoTrailingSlash } from '../../misc';
	import {
		sponsorBlockCategoriesStore,
		sponsorBlockDisplayToastStore,
		sponsorBlockStore,
		sponsorBlockTimelineStore,
		sponsorBlockUrlStore
	} from '../../store';

	let sponsorCategoriesList: string[] = [];
	sponsorBlockCategoriesStore.subscribe((value) => (sponsorCategoriesList = value));

	let sponsorBlockInstance = get(sponsorBlockUrlStore);

	const sponsorCategories = [
		{ name: $_('layout.sponsors.sponsor'), category: 'sponsor' },
		{ name: $_('layout.sponsors.unpaidSelfPromotion'), category: 'selfpromo' },
		{ name: $_('layout.sponsors.interactionReminder'), category: 'interaction' },
		{ name: $_('layout.sponsors.intermissionIntroAnimation'), category: 'intro' },
		{ name: $_('layout.sponsors.credits'), category: 'outro' },
		{ name: $_('layout.sponsors.preViewRecapHook'), category: 'preview' },
		{ name: $_('layout.sponsors.tangentJokes'), category: 'filler' }
	];

	function toggleSponsor(category: string) {
		if (sponsorCategoriesList.includes(category)) {
			sponsorBlockCategoriesStore.set(sponsorCategoriesList.filter((value) => value !== category));
		} else {
			sponsorCategoriesList.push(category);
			sponsorBlockCategoriesStore.set(sponsorCategoriesList);
		}
	}
</script>

<form
	on:submit|preventDefault={() =>
		sponsorBlockUrlStore.set(ensureNoTrailingSlash(sponsorBlockInstance))}
>
	<nav>
		<div class="field label border max">
			<input bind:value={sponsorBlockInstance} name="sponsorblock-instance" type="text" />
			<label for="sponsorblock-instance">{$_('layout.instanceUrl')}</label>
		</div>
		<button class="square round">
			<i>done</i>
		</button>
	</nav>
</form>

<nav class="no-padding">
	<div class="max">
		<p>{$_('enabled')}</p>
	</div>
	<label class="switch">
		<input
			bind:checked={$sponsorBlockStore}
			on:click={() => sponsorBlockStore.set(!$sponsorBlockStore)}
			type="checkbox"
		/>
		<span></span>
	</label>
</nav>

<nav class="no-padding">
	<div class="max">
		<p>{$_('layout.sponsors.disableToast')}</p>
	</div>
	<label class="switch">
		<input
			bind:checked={$sponsorBlockDisplayToastStore}
			on:click={() => sponsorBlockDisplayToastStore.set(!$sponsorBlockDisplayToastStore)}
			type="checkbox"
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
			on:click={() => sponsorBlockTimelineStore.set(!$sponsorBlockTimelineStore)}
			type="checkbox"
		/>
		<span></span>
	</label>
</nav>

<hr style="margin: 1em 0;" />

<p class="bold">{$_('layout.sponsors.Catagories')}</p>

{#each sponsorCategories as sponsor}
	<div class="field middle-align no-margin">
		<nav class="no-padding">
			<div class="max">
				<p>{sponsor.name}</p>
			</div>
			<label class="switch">
				<input
					type="checkbox"
					checked={sponsorCategoriesList.includes(sponsor.category)}
					on:click={() => toggleSponsor(sponsor.category)}
				/>
				<span></span>
			</label>
		</nav>
	</div>
{/each}
