<script lang="ts">
	import { _ } from '$lib/i18n';
	import { logout } from '$lib/misc';

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
			logout();
		}
	}
</script>

<h6>Passsword reset</h6>

<h6>Delete account</h6>
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
