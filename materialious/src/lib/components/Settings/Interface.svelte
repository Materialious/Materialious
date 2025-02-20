<script lang="ts">
	import { preventDefault } from 'svelte/legacy';

	import { goto } from '$app/navigation';
	import { bookmarkletSaveToUrl } from '$lib/externalSettings';
	import { letterCase, titleCases } from '$lib/letterCasing';
	import { setAmoledTheme } from '$lib/theme';
	import { Clipboard } from '@capacitor/clipboard';
	import { Capacitor } from '@capacitor/core';
	import ui from 'beercss';
	import { iso31661 } from 'iso-3166';
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import { ensureNoTrailingSlash } from '../../misc';
	import { getPages } from '../../navPages';
	import {
		authStore,
		darkModeStore,
		instanceStore,
		interfaceAmoledTheme,
		interfaceAutoExpandComments,
		interfaceAutoExpandDesc,
		interfaceDefaultPage,
		interfaceDisplayThumbnailAvatars,
		interfaceForceCase,
		interfaceLowBandwidthMode,
		interfaceRegionStore,
		interfaceSearchHistoryEnabled,
		interfaceSearchSuggestionsStore,
		searchHistoryStore,
		themeColorStore
	} from '../../store';

	let invidiousInstance = $state(get(instanceStore));
	let region = $state(get(interfaceRegionStore));
	let forceCase = $state(get(interfaceForceCase));
	let defaultPage = $state(get(interfaceDefaultPage));

	async function setColor(color: any) {
		const target = color.target;
		const hex = (target as { value: string }).value;
		await ui('theme', hex);
		setAmoledTheme();
		themeColorStore.set(hex);
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
</script>

{#if Capacitor.isNativePlatform()}
	<form
		onsubmit={preventDefault(() => {
			instanceStore.set(ensureNoTrailingSlash(invidiousInstance));
			authStore.set(null);
			goto('/', { replaceState: true });
			ui('#dialog-settings');
		})}
	>
		<nav>
			<div class="field label border max">
				<input bind:value={invidiousInstance} name="invidious-instance" type="text" />
				<label for="invidious-instance">{$_('layout.instanceUrl')}</label>
			</div>
			<button class="square round">
				<i>done</i>
			</button>
		</nav>
	</form>
{/if}

<div class="margin"></div>

<button onclick={toggleDarkMode} class="no-margin">
	{#if !$darkModeStore}
		<i>dark_mode</i>
		<span>{$_('layout.theme.darkMode')}</span>
	{:else}
		<i>light_mode</i>
		<span>{$_('layout.theme.lightMode')}</span>
	{/if}
</button>
<button>
	<i>palette</i>
	<span>{$_('layout.theme.color')}</span>
	<input onchange={setColor} type="color" />
</button>

<div class="margin"></div>

{#if $darkModeStore}
	<div class="field no-margin">
		<nav class="no-padding">
			<div class="max">
				<div>{$_('layout.theme.AmoledTheme')}</div>
			</div>
			<label class="switch">
				<input
					type="checkbox"
					bind:checked={$interfaceAmoledTheme}
					onclick={() => interfaceAmoledTheme.set(!$interfaceAmoledTheme)}
				/>
				<span></span>
			</label>
		</nav>
	</div>
{/if}

<div class="field no-margin">
	<nav class="no-padding">
		<div class="max">
			<div>{$_('layout.displayThumbnailAvatars')}</div>
		</div>
		<label class="switch">
			<input
				type="checkbox"
				bind:checked={$interfaceDisplayThumbnailAvatars}
				onclick={() => interfaceDisplayThumbnailAvatars.set(!$interfaceDisplayThumbnailAvatars)}
			/>
			<span></span>
		</label>
	</nav>
</div>

<div class="field no-margin">
	<nav class="no-padding">
		<div class="max">
			<div>{$_('layout.searchHistory')}</div>
		</div>
		<label class="switch">
			<input
				type="checkbox"
				bind:checked={$interfaceSearchHistoryEnabled}
				onclick={() => {
					interfaceSearchHistoryEnabled.set(!$interfaceSearchHistoryEnabled);
					searchHistoryStore.set([]);
				}}
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
		<label class="switch">
			<input
				type="checkbox"
				bind:checked={$interfaceLowBandwidthMode}
				onclick={() => interfaceLowBandwidthMode.set(!$interfaceLowBandwidthMode)}
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
		<label class="switch">
			<input
				type="checkbox"
				bind:checked={$interfaceSearchSuggestionsStore}
				onclick={() => interfaceSearchSuggestionsStore.set(!$interfaceSearchSuggestionsStore)}
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
		<label class="switch">
			<input
				type="checkbox"
				bind:checked={$interfaceAutoExpandDesc}
				onclick={() => interfaceAutoExpandDesc.set(!$interfaceAutoExpandDesc)}
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
		<label class="switch">
			<input
				type="checkbox"
				bind:checked={$interfaceAutoExpandComments}
				onclick={() => interfaceAutoExpandComments.set(!$interfaceAutoExpandComments)}
			/>
			<span></span>
		</label>
	</nav>
</div>

<div class="field label suffix border">
	<select name="region" bind:value={region} onchange={() => interfaceRegionStore.set(region)}>
		{#each iso31661 as region}
			<option selected={$interfaceRegionStore === region.alpha2} value={region.alpha2}
				>{region.alpha2} - {region.name}</option
			>
		{/each}
	</select>
	<label for="region">{$_('region')}</label>
	<i>arrow_drop_down</i>
</div>

<div class="field label suffix border">
	<select name="case" bind:value={forceCase} onchange={() => interfaceForceCase.set(forceCase)}>
		<option selected={$interfaceForceCase === null} value={null}>Default</option>
		{#each titleCases as caseType}
			<option selected={$interfaceForceCase === caseType} value={caseType}
				>{letterCase(`${caseType}`, caseType)}</option
			>
		{/each}
	</select>
	<label for="case">{$_('letterCase')}</label>
	<i>arrow_drop_down</i>
</div>

<div class="field label suffix border">
	<select
		name="defaultPage"
		bind:value={defaultPage}
		onchange={() => interfaceDefaultPage.set(defaultPage)}
	>
		{#each getPages() as page}
			{#if !page.requiresAuth || get(authStore)}
				<option selected={$interfaceDefaultPage === page.href} value={page.href}>{page.name}</option
				>
			{/if}
		{/each}
	</select>
	<label for="defaultPage">{$_('defaultPage')}</label>
	<i>arrow_drop_down</i>
</div>

{#if !Capacitor.isNativePlatform()}
	<div class="settings">
		<h6>{$_('layout.bookmarklet')}</h6>
		<button
			class="no-margin"
			onclick={async () => await Clipboard.write({ string: bookmarkletSaveToUrl() })}
			>{$_('copyUrl')}</button
		>
	</div>
{/if}
