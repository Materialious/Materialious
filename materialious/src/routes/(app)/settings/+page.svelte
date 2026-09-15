<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from '$lib/i18n';
	import { getNextFocus } from '@bbc/tv-lrud-spatial';
	import { keyCodeMap, isAndroidTv } from '$lib/utils';
	import { materialiousBackendStore, rawMasterKeyStore } from '$lib/store';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		getSettingsTabs,
		getTabLabel,
		updateAccountTabs,
		type SettingsTab,
		type SettingsTabCategories
	} from '$lib/components/settings/tabs';

	let tabs: SettingsTab[] = $state(updateAccountTabs(getSettingsTabs()));

	rawMasterKeyStore.subscribe(() => {
		tabs = updateAccountTabs(tabs);
	});

	materialiousBackendStore.subscribe(() => {
		tabs = updateAccountTabs(tabs);
	});

	let activeTab: SettingsTabCategories = $state('interface');

	let settingsContainer: HTMLElement | undefined = $state();

	const isActive = (id: string) => activeTab === id;

	function handleKeyDown(event: KeyboardEvent) {
		const keyCode = keyCodeMap[event.key];
		if (!keyCode) return;

		const target = event.target as HTMLElement;

		// Let native controls handle arrows themselves (inputs, selects).
		if (
			target instanceof HTMLSelectElement ||
			target instanceof HTMLInputElement ||
			target instanceof HTMLTextAreaElement
		) {
			return;
		}

		// If focus is stranded inside a hidden panel, return to the active category.
		if (target.closest('.lrud-ignore') || !settingsContainer?.contains(target)) {
			document.getElementById(`tv-settings-tab-${activeTab}`)?.focus();
			return;
		}

		const nextFocus = getNextFocus(target, keyCode, settingsContainer);
		if (nextFocus) {
			event.preventDefault();
			nextFocus.focus();
			nextFocus.scrollIntoView({
				behavior: 'instant',
				block: 'nearest',
				inline: 'nearest'
			});
		}
	}

	onMount(() => {
		if (!isAndroidTv()) {
			void goto(resolve('/', {}), { replaceState: true });
			return;
		}

		document.getElementById(`tv-settings-tab-${activeTab}`)?.focus();
	});
</script>

<div class="tv-settings grid" bind:this={settingsContainer} onkeydown={handleKeyDown}>
	<nav class="s12 no-space small-padding">
		<h4>{$_('layout.settings')}</h4>
		<div class="max"></div>
		<button
			class="circle surface-container-highest"
			tabindex="0"
			onclick={() => window.history.back()}
		>
			<i>close</i>
		</button>
	</nav>

	<nav
		class="categories s12 m3 vertical small-space scroll padding"
		role="tablist"
		aria-orientation="vertical"
	>
		{#each tabs as tab (tab.id)}
			<button
				id="tv-settings-tab-{tab.id}"
				class:active={isActive(tab.id)}
				class:surface-container-lowest={isActive(tab.id)}
				class:surface-container-highest={!isActive(tab.id)}
				role="tab"
				aria-selected={isActive(tab.id)}
				tabindex="0"
				onclick={() => (activeTab = tab.id)}
			>
				<i>{tab.icon}</i>
				<span>{getTabLabel(tab, $_)}</span>
			</button>
		{/each}
	</nav>

	<section class="s12 m9 scroll padding">
		{#each tabs as tab (tab.id)}
			<div
				role="tabpanel"
				aria-labelledby="tv-settings-tab-{tab.id}"
				hidden={!isActive(tab.id)}
				class:lrud-ignore={!isActive(tab.id)}
			>
				<tab.component />
			</div>
		{/each}
	</section>
</div>

<style>
	.tv-settings {
		height: 100%;
		grid-template-rows: auto minmax(0, 1fr);
	}

	.tv-settings > * {
		min-height: 0;
	}

	.categories {
		border-right: 1px solid var(--secondary);
		border-radius: 0;
	}

	.categories button {
		width: 100%;
		box-sizing: border-box !important;
	}
</style>
