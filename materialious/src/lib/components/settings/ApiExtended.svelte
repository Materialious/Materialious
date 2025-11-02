<script lang="ts">
	import { preventDefault } from 'svelte/legacy';

	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import { ensureNoTrailingSlash } from '../../misc';
	import { synciousInstanceStore, synciousStore } from '../../store';

	let synciousInstance = $state(get(synciousInstanceStore));
</script>

<form
	onsubmit={preventDefault(() =>
		synciousInstanceStore.set(ensureNoTrailingSlash(synciousInstance))
	)}
>
	<nav>
		<div class="field label border max">
			<input tabindex="0" bind:value={synciousInstance} name="syncious-instance" type="text" />
			<label tabindex="-1" for="syncious-instance">{$_('layout.instanceUrl')}</label>
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
	<label class="switch" tabindex="0">
		<input
			bind:checked={$synciousStore}
			onclick={() => synciousStore.set(!$synciousStore)}
			type="checkbox"
			role="switch"
		/>
		<span></span>
	</label>
</nav>
