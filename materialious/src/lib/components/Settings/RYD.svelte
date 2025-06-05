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
		<div class="field label border max">
			<input bind:value={returnYTInstance} name="returnyt-instance" type="text" />
			<label for="returnyt-instance">{$_('layout.instanceUrl')}</label>
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
			bind:checked={$returnYtDislikesStore}
			onclick={() => returnYtDislikesStore.set(!$returnYtDislikesStore)}
			type="checkbox"
		/>
		<span></span>
	</label>
</nav>
