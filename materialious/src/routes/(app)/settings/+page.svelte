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

	const KEYBOARD_INPUT_TYPES = [
		'text',
		'url',
		'email',
		'search',
		'tel',
		'password',
		'number',
		'date',
		'time',
		'datetime-local',
		'month',
		'week'
	];

	const isKeyboardInput = (el: Element | null): el is HTMLInputElement | HTMLTextAreaElement => {
		if (el instanceof HTMLTextAreaElement) return true;
		if (el instanceof HTMLInputElement) return KEYBOARD_INPUT_TYPES.includes(el.type);
		return false;
	};

	function lockInput(input: HTMLInputElement | HTMLTextAreaElement) {
		input.readOnly = true;
	}

	function unlockInput(input: HTMLInputElement | HTMLTextAreaElement) {
		input.readOnly = false;
		input.focus();
	}

	// Re-lock text fields whenever they lose focus so browsing past them never
	// summons the on-screen keyboard.
	function onSettingsFocusOut(event: FocusEvent) {
		const el = event.target as Element;
		if (isKeyboardInput(el) && !el.readOnly) lockInput(el);
	}

	// A click/press opens the field and pulls up the keyboard.
	function onSettingsClick(event: MouseEvent) {
		const el = (event.target as Element).closest('input, textarea');
		if (el && isKeyboardInput(el) && el.readOnly) unlockInput(el);
	}

	function handleKeyDown(event: KeyboardEvent) {
		const keyCode = keyCodeMap[event.key];
		if (!keyCode) return;

		const target = event.target as HTMLElement;

		// OK/Enter on a locked text field opens it and pulls up the keyboard.
		if (event.key === 'Enter' && isKeyboardInput(target) && target.readOnly) {
			event.preventDefault();
			unlockInput(target);
			return;
		}

		const isArrow = keyCode === 37 || keyCode === 38 || keyCode === 39 || keyCode === 40;
		if (!isArrow) return;

		// Let open/native controls handle arrows themselves (inputs, selects).
		if (
			target instanceof HTMLSelectElement ||
			((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
				!target.readOnly)
		) {
			return;
		}

		// If focus is stranded inside a hidden panel, return to the active category.
		if (target.closest('.lrud-ignore') || !settingsContainer?.contains(target)) {
			event.preventDefault();
			document.getElementById(`tv-settings-tab-${activeTab}`)?.focus();
			return;
		}

		// From the categories column, LEFT continues out into the app side nav.
		if (keyCode === 37 && target.closest('.categories')) {
			event.preventDefault();
			const settingsNavLink = document.querySelector(
				'#left-nav a[href="/settings"]'
			) as HTMLElement | null;
			const navLinks = Array.from(document.querySelectorAll('#left-nav a')) as HTMLElement[];
			const targetLink = settingsNavLink ?? navLinks.at(-1);
			targetLink?.focus();
			return;
		}

		// Keep vertical navigation within the current column so LRUD doesn't
		// pick spatially-nearer buttons from the other column. Up from the
		// categories column keeps the full scope so the header close button
		// stays reachable.
		const isVertical = keyCode === 40 || keyCode === 38;
		let scope: HTMLElement | undefined = settingsContainer;
		if (isVertical) {
			const panel = target.closest('[role="tabpanel"]');
			if (panel) {
				scope = panel as HTMLElement;
			} else if (target.closest('.categories') && keyCode === 40) {
				scope = target.closest('.categories') as HTMLElement;
			}
		}

		const nextFocus = getNextFocus(target, keyCode, scope);

		// Own the navigation on TV so focus never leaks out to the app's nav.
		if (!nextFocus) {
			event.preventDefault();
			return;
		}

		event.preventDefault();

		// Land on text fields without summoning the keyboard; OK/Enter opens them.
		if (isKeyboardInput(nextFocus)) lockInput(nextFocus);

		nextFocus.focus();
		nextFocus.scrollIntoView({
			behavior: 'instant',
			block: 'nearest',
			inline: 'nearest'
		});
	}

	onMount(() => {
		if (!isAndroidTv()) {
			void goto(resolve('/', {}), { replaceState: true });
			return;
		}

		const container = settingsContainer;
		if (container) {
			container.addEventListener('focusout', onSettingsFocusOut, true);
			container.addEventListener('click', onSettingsClick, true);
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
