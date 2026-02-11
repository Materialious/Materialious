<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { bookmarkletSaveToUrl } from '$lib/externalSettings';
	import { letterCase, titleCases } from '$lib/letterCasing';
	import { setAmoledTheme } from '$lib/theme';
	import { Clipboard } from '@capacitor/clipboard';
	import { Capacitor } from '@capacitor/core';
	import ui from 'beercss';
	import { iso31661 } from 'iso-3166';
	import type { RgbaColor, HsvaColor, Colord } from 'colord';
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import { ensureNoTrailingSlash, isMobile, logoutStores } from '../../misc';
	import { getPages, type Pages } from '../../navPages';
	import ColorPicker from 'svelte-awesome-color-picker';
	import {
		authStore,
		backendInUseStore,
		darkModeStore,
		instanceStore,
		interfaceAllowInsecureRequests,
		interfaceAmoledTheme,
		interfaceAndroidUseNativeShare,
		interfaceAutoExpandChapters,
		interfaceAutoExpandComments,
		interfaceAutoExpandDesc,
		interfaceDefaultPage,
		interfaceDisableAutoUpdate,
		interfaceForceCase,
		interfaceLowBandwidthMode,
		interfaceRegionStore,
		interfaceSearchHistoryEnabled,
		interfaceSearchSuggestionsStore,
		searchHistoryStore,
		themeColorStore
	} from '../../store';
	import { addToast } from '../Toast.svelte';
	import { tick } from 'svelte';

	let invidiousInstance = $state(get(instanceStore));
	let region = $state(get(interfaceRegionStore));
	let forceCase = $state(get(interfaceForceCase));
	let defaultPage = $state(get(interfaceDefaultPage));

	let invalidInstance = $state(false);
	let colorPickerOpen = $state(false);
	let colorPickerDebounce: ReturnType<typeof setTimeout>;

	async function setColor(color: {
		hsv: HsvaColor | null;
		rgb: RgbaColor | null;
		hex: string | null;
		color: Colord | null;
	}) {
		if (!color.hex) return;
		if (colorPickerDebounce) clearTimeout(colorPickerDebounce);

		colorPickerDebounce = setTimeout(async () => {
			themeColorStore.set(color.hex);
			await tick();
			setAmoledTheme();
		}, 10);
	}

	function toggleDarkMode() {
		const isDark = get(darkModeStore);

		if (isDark) {
			ui('mode', 'light');
			darkModeStore.set(false);
		} else {
			ui('mode', 'dark');
			darkModeStore.set(true);
		}
	}

	function clearPreviousInstance() {
		logoutStores();
		ui('#dialog-settings');
		goto(resolve('/', {}), { replaceState: true });
		location.reload();
	}

	async function setInstance(event: Event) {
		event.preventDefault();

		invalidInstance = false;

		const instance = ensureNoTrailingSlash(invidiousInstance);

		try {
			new URL(instance);
		} catch {
			invalidInstance = true;
		}

		if (invalidInstance) return;

		let resp;
		try {
			resp = await fetch(`${instance}/api/v1/channels/UCH-_hzb2ILSCo9ftVSnrCIQ`);
		} catch {
			invalidInstance = true;
		}

		if (invalidInstance) return;

		if (resp && !resp.ok) {
			invalidInstance = true;
			return;
		}

		instanceStore.set(instance);

		clearPreviousInstance();
	}

	async function setBackend(event: Event) {
		const select = event.target as HTMLSelectElement;
		backendInUseStore.set(select.value as 'ivg' | 'yt');
		clearPreviousInstance();
	}

	function allowInsecureRequests() {
		if (!Capacitor.isNativePlatform()) return;
		interfaceAllowInsecureRequests.set(!$interfaceAllowInsecureRequests);
	}

	// Used to toggle rejectUnauthorized in the backend
	interfaceAllowInsecureRequests.subscribe(async (isAllowed) => {
		if (Capacitor.getPlatform() === 'android') {
			if (isAllowed) {
				await fetch('http://materialious__allow-insecure-requests');
			} else {
				await fetch('http://materialious__deny-insecure-requests');
			}
		} else if (Capacitor.getPlatform() === 'electron') {
			await window.electronAPI.setAllowInsecureSSL(isAllowed);
		}
	});

	if (Capacitor.getPlatform() === 'electron') {
		interfaceDisableAutoUpdate.subscribe((isDisabled) => {
			window.electronAPI.doUpdateCheck(isDisabled);
		});
	}

	let pages: Pages = $state([]);
	authStore.subscribe(() => {
		pages = getPages();
	});
</script>

{#if Capacitor.isNativePlatform()}
	<div class="field label suffix border">
		<select name="backend-in-use" onchange={setBackend}>
			<option selected={$backendInUseStore === 'ivg'} value="ivg">Invidious</option>
			<option selected={$backendInUseStore === 'yt'} value="yt">YouTube</option>
		</select>
		<label for="backend-in-use">{$_('backend')}</label>
		<i>arrow_drop_down</i>
	</div>

	{#if $backendInUseStore === 'ivg'}
		<form onsubmit={setInstance}>
			<nav>
				<div class="field label border max" class:invalid={invalidInstance}>
					<input
						tabindex="0"
						bind:value={invidiousInstance}
						name="invidious-instance"
						type="text"
					/>
					<label tabindex="-1" for="invidious-instance">{$_('layout.instanceUrl')}</label>
					{#if invalidInstance}
						<span class="error">{$_('invalidInstance')}</span>
					{/if}
				</div>
				<button class="square round">
					<i>done</i>
				</button>
			</nav>
		</form>
	{:else}
		<div class="space"></div>
	{/if}

	{#if isMobile()}
		{#if invalidInstance}
			<div style="margin-bottom: 6em;"></div>
		{/if}
	{/if}

	{#if Capacitor.isNativePlatform() && (invalidInstance || $interfaceAllowInsecureRequests)}
		<div class="field no-margin">
			<nav class="no-padding">
				<div class="max">
					<div>{$_('layout.allowInsecureRequests')}</div>
				</div>
				<label class="switch" tabindex="0">
					<input
						type="checkbox"
						bind:checked={$interfaceAllowInsecureRequests}
						onclick={allowInsecureRequests}
						role="switch"
					/>
					<span></span>
				</label>
			</nav>
		</div>
	{/if}
{/if}

<button onclick={toggleDarkMode} class="no-margin">
	{#if !$darkModeStore}
		<i>dark_mode</i>
		<span>{$_('layout.theme.darkMode')}</span>
	{:else}
		<i>light_mode</i>
		<span>{$_('layout.theme.lightMode')}</span>
	{/if}
</button>
<button onclick={() => (colorPickerOpen = !colorPickerOpen)}>
	<i>palette</i>
	<span>{$_('layout.theme.color')}</span>
</button>

{#if colorPickerOpen}
	<div class="space"></div>

	<div class="color-picker">
		<ColorPicker
			isTextInput={false}
			isDialog={false}
			onInput={setColor}
			position="responsive"
			isAlpha={false}
			sliderDirection="horizontal"
		/>
	</div>
{/if}

<div class="space"></div>

{#if $darkModeStore}
	<div class="field no-margin">
		<nav class="no-padding">
			<div class="max">
				<div>{$_('layout.theme.AmoledTheme')}</div>
			</div>
			<label class="switch" tabindex="0">
				<input
					type="checkbox"
					bind:checked={$interfaceAmoledTheme}
					onclick={() => interfaceAmoledTheme.set(!$interfaceAmoledTheme)}
					role="switch"
				/>
				<span></span>
			</label>
		</nav>
	</div>
{/if}

<div class="field no-margin">
	<nav class="no-padding">
		<div class="max">
			<div>{$_('layout.searchHistory')}</div>
		</div>
		<label class="switch" tabindex="0">
			<input
				type="checkbox"
				bind:checked={$interfaceSearchHistoryEnabled}
				onclick={() => {
					interfaceSearchHistoryEnabled.set(!$interfaceSearchHistoryEnabled);
					searchHistoryStore.set([]);
				}}
				role="switch"
			/>
			<span></span>
		</label>
	</nav>
</div>

<div class="field no-margin">
	<nav class="no-padding">
		<div class="max">
			<div>{$_('layout.lowBandwidthMode')}</div>
		</div>
		<label class="switch" tabindex="0">
			<input
				type="checkbox"
				bind:checked={$interfaceLowBandwidthMode}
				onclick={() => interfaceLowBandwidthMode.set(!$interfaceLowBandwidthMode)}
				role="switch"
			/>
			<span></span>
		</label>
	</nav>
</div>

<div class="field no-margin">
	<nav class="no-padding">
		<div class="max">
			<div>{$_('layout.searchSuggestions')}</div>
		</div>
		<label class="switch" tabindex="0">
			<input
				type="checkbox"
				bind:checked={$interfaceSearchSuggestionsStore}
				onclick={() => interfaceSearchSuggestionsStore.set(!$interfaceSearchSuggestionsStore)}
				role="switch"
			/>
			<span></span>
		</label>
	</nav>
</div>

<div class="field no-margin">
	<nav class="no-padding">
		<div class="max">
			<div>{$_('layout.expandDescription')}</div>
		</div>
		<label class="switch" tabindex="0">
			<input
				type="checkbox"
				bind:checked={$interfaceAutoExpandDesc}
				onclick={() => interfaceAutoExpandDesc.set(!$interfaceAutoExpandDesc)}
				role="switch"
			/>
			<span></span>
		</label>
	</nav>
</div>

<div class="field no-margin">
	<nav class="no-padding">
		<div class="max">
			<div>{$_('layout.expandChapters')}</div>
		</div>
		<label class="switch" tabindex="0">
			<input
				type="checkbox"
				bind:checked={$interfaceAutoExpandChapters}
				onclick={() => interfaceAutoExpandChapters.set(!$interfaceAutoExpandChapters)}
				role="switch"
			/>
			<span></span>
		</label>
	</nav>
</div>

<div class="field no-margin">
	<nav class="no-padding">
		<div class="max">
			<div>{$_('layout.expandComments')}</div>
		</div>
		<label class="switch" tabindex="0">
			<input
				type="checkbox"
				bind:checked={$interfaceAutoExpandComments}
				onclick={() => interfaceAutoExpandComments.set(!$interfaceAutoExpandComments)}
				role="switch"
			/>
			<span></span>
		</label>
	</nav>
</div>

{#if Capacitor.getPlatform() == 'android'}
	<div class="field no-margin">
		<nav class="no-padding">
			<div class="max">
				<div>{$_('layout.androidNativeShare')}</div>
			</div>
			<label class="switch" tabindex="0">
				<input
					type="checkbox"
					bind:checked={$interfaceAndroidUseNativeShare}
					onclick={() => interfaceAndroidUseNativeShare.set(!$interfaceAndroidUseNativeShare)}
					role="switch"
				/>
				<span></span>
			</label>
		</nav>
	</div>
{/if}

{#if Capacitor.getPlatform() == 'electron'}
	<div class="field no-margin">
		<nav class="no-padding">
			<div class="max">
				<div>{$_('layout.disableAutoUpdate')}</div>
			</div>
			<label class="switch" tabindex="0">
				<input
					type="checkbox"
					bind:checked={$interfaceDisableAutoUpdate}
					onclick={() => interfaceDisableAutoUpdate.set(!$interfaceDisableAutoUpdate)}
					role="switch"
				/>
				<span></span>
			</label>
		</nav>
	</div>
{/if}

<div class="field label suffix border">
	<select
		tabindex="0"
		name="region"
		bind:value={region}
		onchange={() => interfaceRegionStore.set(region)}
	>
		{#each iso31661 as region (region)}
			<option selected={$interfaceRegionStore === region.alpha2} value={region.alpha2}
				>{region.alpha2} - {region.name}</option
			>
		{/each}
	</select>
	<label tabindex="-1" for="region">{$_('region')}</label>
	<i>arrow_drop_down</i>
</div>

<div class="field label suffix border">
	<select
		tabindex="0"
		name="case"
		bind:value={forceCase}
		onchange={() => interfaceForceCase.set(forceCase)}
	>
		<option selected={$interfaceForceCase === null} value={null}>Default</option>
		{#each titleCases as caseType (caseType)}
			<option selected={$interfaceForceCase === caseType} value={caseType}
				>{letterCase(`${caseType}`, caseType)}</option
			>
		{/each}
	</select>
	<label tabindex="-1" for="case">{$_('letterCase')}</label>
	<i>arrow_drop_down</i>
</div>

<div class="field label suffix border">
	<select
		name="defaultPage"
		tabindex="0"
		bind:value={defaultPage}
		onchange={() => interfaceDefaultPage.set(defaultPage)}
	>
		{#each pages as page (page)}
			{#if !page.requiresAuth || get(authStore)}
				<option selected={$interfaceDefaultPage === page.href} value={page.href}>{page.name}</option
				>
			{/if}
		{/each}
	</select>
	<label tabindex="-1" for="defaultPage">{$_('defaultPage')}</label>
	<i>arrow_drop_down</i>
</div>

{#if !Capacitor.isNativePlatform()}
	<div class="space"></div>
	<div class="settings">
		<h6>{$_('layout.bookmarklet')}</h6>
		<button
			class="no-margin"
			onclick={async () => {
				await Clipboard.write({ string: bookmarkletSaveToUrl() });
				addToast({
					data: {
						text: $_('player.share.copiedSuccess')
					}
				});
			}}>{$_('copyUrl')}</button
		>
	</div>
{/if}

<style>
	.color-picker {
		--cp-bg-color: var(--surface-container);
		--cp-border-color: transparent;
		--cp-text-color: var(--on-surface);
		--cp-input-color: var(--surface);
		--cp-button-hover-color: var(--surface-variant);
		--slider-width: 50px;
		--picker-width: 45vw;
		width: 100%;
	}

	@media screen and (max-width: 640px) {
		.color-picker {
			--picker-width: 85vw;
		}
	}
</style>
