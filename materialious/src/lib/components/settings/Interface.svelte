<script lang="ts">
	import { bookmarkletSaveToUrl } from '$lib/externalSettings/index';
	import { letterCase, titleCases } from '$lib/letterCasing';
	import { setAmoledTheme } from '$lib/theme';
	import { Clipboard } from '@capacitor/clipboard';
	import { Capacitor } from '@capacitor/core';
	import ui from 'beercss';
	import { iso31661 } from 'iso-3166';
	import type { RgbaColor, HsvaColor, Colord } from 'colord';
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import {
		isUnrestrictedPlatform,
		setInvidiousInstance,
		goToInvidiousLogin,
		invidiousLogout,
		timeout
	} from '../../misc';
	import { getPages, type Pages } from '../../navPages';
	import ColorPicker from 'svelte-awesome-color-picker';
	import {
		invidiousAuthStore,
		backendInUseStore,
		darkModeStore,
		invidiousInstanceStore,
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
	import { isOwnBackend } from '$lib/shared';

	let invidiousInstance = $state(get(invidiousInstanceStore));
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

	async function setInstance(event: Event) {
		event.preventDefault();
		invalidInstance = !(await setInvidiousInstance(invidiousInstance));

		await timeout(100);
		location.reload();
	}

	async function setBackend(event: Event) {
		const select = event.target as HTMLSelectElement;
		backendInUseStore.set(select.value as 'ivg' | 'yt');

		await timeout(100);
		location.reload();
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
	invidiousAuthStore.subscribe(() => {
		pages = getPages();
	});
</script>

{#if isUnrestrictedPlatform()}
	<div class="field label suffix surface-container-highest">
		<select name="backend-in-use" onchange={setBackend}>
			<option selected={$backendInUseStore === 'ivg'} value="ivg">Invidious</option>
			<option selected={$backendInUseStore === 'yt'} value="yt">YouTube (Experimental)</option>
		</select>
		<label for="backend-in-use">{$_('backend')}</label>
		<i>arrow_drop_down</i>
	</div>

	{#if $backendInUseStore === 'ivg'}
		<form onsubmit={setInstance}>
			<nav>
				<div
					class="field prefix suffix label surface-container-highest max"
					class:invalid={invalidInstance}
				>
					<i>link</i>
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
					{#if $invidiousInstanceStore}
						<i
							role="presentation"
							class="front"
							onclick={() => {
								invidiousInstanceStore.set(undefined);
								invidiousInstance = undefined;
								invidiousLogout();
							}}>close</i
						>
					{/if}
				</div>
				<button class="square">
					<i>done</i>
				</button>
			</nav>
		</form>
		{#if isOwnBackend()?.internalAuth && $invidiousInstanceStore}
			{#if !$invidiousAuthStore}
				<button onclick={goToInvidiousLogin}>
					<i>link</i>
					<span>{$_('linkInvidious')}</span>
				</button>
			{:else}
				<button onclick={invidiousLogout}>
					<i>link_off</i>
					<span>{$_('unlinkInvidious')}</span>
				</button>
			{/if}
			<div class="space"></div>
		{/if}
	{:else}
		<div class="space"></div>
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
			hex={$themeColorStore}
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

<div class="field label suffix surface-container-highest">
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

<div class="field label suffix surface-container-highest">
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

<div class="field label suffix surface-container-highest">
	<select
		name="defaultPage"
		tabindex="0"
		bind:value={defaultPage}
		onchange={() => interfaceDefaultPage.set(defaultPage)}
	>
		{#each pages as page (page)}
			{#if !page.requiresAuth || get(invidiousAuthStore)}
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
		<div class="space"></div>
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
		--picker-width: 500px;
		width: 100%;
	}

	@media screen and (max-width: 640px) {
		.color-picker {
			--picker-width: 85vw;
		}
	}
</style>
