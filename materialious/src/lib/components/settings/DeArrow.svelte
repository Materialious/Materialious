<script lang="ts">
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import { ensureNoTrailingSlash } from '../../misc';
	import {
		deArrowEnabledStore,
		deArrowInstanceStore,
		deArrowThumbnailInstanceStore,
		deArrowTitlesOnly
	} from '../../store';

	let deArrowUrl = $state(get(deArrowInstanceStore));
	let deArrowThumbnailUrl = $state(get(deArrowThumbnailInstanceStore));
</script>

<form
	onsubmit={(event: Event) => {
		event.preventDefault();
		deArrowInstanceStore.set(ensureNoTrailingSlash(deArrowUrl));
	}}
>
	<nav>
		<div class="field prefix label surface-container-highest max">
			<i>link</i>
			<input bind:value={deArrowUrl} name="dearrow-instance" type="text" />
			<label for="dearrow-instance">{$_('layout.instanceUrl')}</label>
		</div>
		<button class="circle">
			<i>done</i>
		</button>
	</nav>
</form>

<form
	onsubmit={(event: Event) => {
		event.preventDefault();
		deArrowThumbnailInstanceStore.set(deArrowThumbnailUrl);
	}}
>
	<nav>
		<div class="field prefix label surface-container-highest max">
			<i>link</i>
			<input bind:value={deArrowThumbnailUrl} name="dearrow-thumbnail-instance" type="text" />
			<label for="dearrow-thumbnail-instance">{$_('layout.deArrow.thumbnailInstanceUrl')}</label>
		</div>
		<button class="circle">
			<i>done</i>
		</button>
	</nav>
</form>

<nav class="no-padding">
	<div class="max">
		<p>{$_('layout.deArrow.titleOnly')}</p>
	</div>
	<label class="switch" tabindex="0">
		<input
			bind:checked={$deArrowTitlesOnly}
			onclick={() => deArrowTitlesOnly.set(!$deArrowTitlesOnly)}
			type="checkbox"
			role="switch"
		/>
		<span></span>
	</label>
</nav>

<nav class="no-padding">
	<div class="max">
		<p>{$_('enabled')}</p>
	</div>
	<label class="switch" tabindex="0">
		<input
			bind:checked={$deArrowEnabledStore}
			onclick={() => deArrowEnabledStore.set(!$deArrowEnabledStore)}
			type="checkbox"
			role="switch"
		/>
		<span></span>
	</label>
</nav>
