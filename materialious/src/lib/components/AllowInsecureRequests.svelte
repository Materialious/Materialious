<script lang="ts">
	import { onMount } from 'svelte';
	import { Capacitor } from '@capacitor/core';
	import { Nodejs } from '@capawesome/capacitor-nodejs';
	import { _ } from '#lib/i18n/index';
	import { timeout } from '#lib/utils';
	import { interfaceAllowInsecureRequests } from '#lib/stores';

	let { show = false }: { show?: boolean } = $props();
	onMount(() => {
		const unsubscribeTLS = interfaceAllowInsecureRequests.subscribe(async (isAllowed) => {
			if (Capacitor.getPlatform() === 'android') {
				try {
					let ready = false;
					while (!ready) {
						({ ready } = await Nodejs.isReady());
						if (!ready) await timeout(100);
					}
					await Nodejs.send({ eventName: 'set-insecure-tls', args: [isAllowed] });
				} catch {
					// The persisted setting is applied when the Node runtime is ready again.
				}
			} else if (Capacitor.getPlatform() === 'electron') {
				await window.electronAPI.setAllowInsecureSSL(isAllowed);
			}
		});
		return unsubscribeTLS;
	});

	function toggle() {
		interfaceAllowInsecureRequests.set(!$interfaceAllowInsecureRequests);
	}
</script>

{#if Capacitor.isNativePlatform() && (show || $interfaceAllowInsecureRequests)}
	<div class="field no-margin">
		<nav class="no-padding">
			<div class="max"><div>{$_('layout.allowInsecureRequests')}</div></div>
			<label class="switch">
				<input
					type="checkbox"
					checked={$interfaceAllowInsecureRequests}
					onclick={toggle}
					role="switch"
				/>
				<span></span>
			</label>
		</nav>
	</div>
{/if}
