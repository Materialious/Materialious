<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import { ensureNoTrailingSlash } from '../../misc';
	import {
		deArrowEnabledStore,
		deArrowInstanceStore,
		deArrowThumbnailInstanceStore,
		deArrowTitlesOnly
	} from '../../store';

	let deArrowUrl = get(deArrowInstanceStore);
	let deArrowThumbnailUrl = get(deArrowThumbnailInstanceStore);
</script>

<form on:submit|preventDefault={() => deArrowInstanceStore.set(ensureNoTrailingSlash(deArrowUrl))}>
	<nav>
		<div class="field label border max">
			<input bind:value={deArrowUrl} name="dearrow-instance" type="text" />
			<label for="dearrow-instance">{$_('layout.instanceUrl')}</label>
		</div>
		<button class="square round">
			<i>done</i>
		</button>
	</nav>
</form>

<form on:submit|preventDefault={() => deArrowThumbnailInstanceStore.set(deArrowThumbnailUrl)}>
	<nav>
		<div class="field label border max">
			<input bind:value={deArrowThumbnailUrl} name="dearrow-thumbnail-instance" type="text" />
			<label for="dearrow-thumbnail-instance">{$_('layout.deArrow.thumbnailInstanceUrl')}</label>
		</div>
		<button class="square round">
			<i>done</i>
		</button>
	</nav>
</form>

<nav class="no-padding">
	<div class="max">
		<p>{$_('layout.deArrow.titleOnly')}</p>
	</div>
	<label class="switch">
		<input
			bind:checked={$deArrowTitlesOnly}
			on:click={() => deArrowTitlesOnly.set(!$deArrowTitlesOnly)}
			type="checkbox"
		/>
		<span></span>
	</label>
</nav>

<nav class="no-padding">
	<div class="max">
		<p>{$_('enabled')}</p>
	</div>
	<label class="switch">
		<input
			bind:checked={$deArrowEnabledStore}
			on:click={() => deArrowEnabledStore.set(!$deArrowEnabledStore)}
			type="checkbox"
		/>
		<span></span>
	</label>
</nav>
