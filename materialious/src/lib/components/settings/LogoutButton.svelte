<script lang="ts">
	import { _ } from '#lib/i18n/index';
	import { logout } from '#lib/auth';
	import { isYTBackend } from '#lib/backend';
	import { isOwnBackend } from '#lib/shared/index';
	import { invidiousAuthStore, materialiousBackendStore, rawMasterKeyStore } from '#lib/store';

	let { fullWidth = false } = $props();

	const accountLoggedIn = $derived(
		(!!$rawMasterKeyStore && (!!isOwnBackend()?.internalAuth || !!$materialiousBackendStore)) ||
			(!!$invidiousAuthStore && !isOwnBackend()?.internalAuth)
	);
</script>

{#if (!isYTBackend() || isOwnBackend()?.internalAuth) && accountLoggedIn}
	<button class={['surface-container-highest', { 'full-width': fullWidth }]} onclick={logout}>
		<i>logout</i>
		<span>{$_('layout.logout')}</span>
	</button>
{/if}

<style>
	.full-width {
		width: 100%;
		box-sizing: border-box;
	}
</style>
