<script lang="ts">
	import { preventDefault } from 'svelte/legacy';

	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import { ensureNoTrailingSlash } from '../../misc';
	import { returnYTDislikesInstanceStore, returnYtDislikesStore } from '../../store';

	let returnYTInstance = $state(get(returnYTDislikesInstanceStore));
</script>

<form
	onsubmit={preventDefault(() =>
		returnYTDislikesInstanceStore.set(ensureNoTrailingSlash(returnYTInstance))
	)}
>
	<nav>
		<div class="field prefix label surface-container-highest max">
			<i>link</i>
			<input tabindex="0" bind:value={returnYTInstance} name="returnyt-instance" type="text" />
			<label tabindex="-1" for="returnyt-instance">{$_('layout.instanceUrl')}</label>
		</div>
		<button class="square">
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
			bind:checked={$returnYtDislikesStore}
			onclick={() => returnYtDislikesStore.set(!$returnYtDislikesStore)}
			type="checkbox"
			role="switch"
		/>
		<span></span>
	</label>
</nav>
