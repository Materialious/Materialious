<script lang="ts">
	import { _ } from '$lib/i18n';
	import { materialiousLogout } from '$lib/auth';
	import { watchHistoryEnabledStore } from '$lib/store';

	let clickCount = $state(0);
	const clicksToDelte = 3;
	let deleteDebounce: ReturnType<typeof setTimeout> | undefined;
	async function deleteAccount() {
		clickCount++;

		if (deleteDebounce) clearTimeout(deleteDebounce);

		deleteDebounce = setTimeout(() => {
			clickCount = 0;
		}, 10000);

		if (clicksToDelte - clickCount === 0) {
			await fetch('/api/user/delete', { method: 'DELETE' });
			materialiousLogout();
		}
	}
</script>

<div class="field no-margin">
	<nav class="no-padding">
		<div class="max">
			<div>{$_('layout.historyEnabled')}</div>
		</div>
		<label class="switch" tabindex="0">
			<input
				type="checkbox"
				bind:checked={$watchHistoryEnabledStore}
				onclick={() => watchHistoryEnabledStore.set(!$watchHistoryEnabledStore)}
				role="switch"
			/>
			<span></span>
		</label>
	</nav>
</div>

<div class="space"></div>
<div class="divider"></div>
<div class="space"></div>

<button class="tertiary" onclick={deleteAccount}>
	<i>warning</i>
	<span>{$_('layout.deleteAccount')}</span>
	{#if clicksToDelte - clickCount > 0}
		<div class="tooltip">
			{$_('layout.clickXmoreTimesToDelete', {
				clicksTillDelete: clicksToDelte - clickCount
			})}
		</div>
	{/if}
</button>
