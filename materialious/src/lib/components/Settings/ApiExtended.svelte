<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import { ensureNoTrailingSlash } from '../../misc';
	import { synciousInstanceStore, synciousStore } from '../../store';

	let synciousInstance = get(synciousInstanceStore);
</script>

<form
	on:submit|preventDefault={() =>
		synciousInstanceStore.set(ensureNoTrailingSlash(synciousInstance))}
>
	<nav>
		<div class="field label border max">
			<input bind:value={synciousInstance} name="syncious-instance" type="text" />
			<label for="syncious-instance">{$_('layout.instanceUrl')}</label>
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
			bind:checked={$synciousStore}
			on:click={() => synciousStore.set(!$synciousStore)}
			type="checkbox"
		/>
		<span></span>
	</label>
</nav>
