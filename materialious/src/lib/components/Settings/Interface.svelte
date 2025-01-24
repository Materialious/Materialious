<script lang="ts">
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
		interfacePreviewVideoOnHoverStore,
		interfaceRegionStore,
		interfaceSearchSuggestionsStore,
		themeColorStore
	} from '../../store';

	let invidiousInstance = get(instanceStore);
	let region = get(interfaceRegionStore);
	let forceCase = get(interfaceForceCase);
	let defaultPage = get(interfaceDefaultPage);

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
		on:submit|preventDefault={() => {
			instanceStore.set(ensureNoTrailingSlash(invidiousInstance));
			authStore.set(null);
			goto('/', { replaceState: true });
			ui('#dialog-settings');
		}}
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

<button on:click={toggleDarkMode} class="no-margin">
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
	<input on:change={setColor} type="color" />
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
					on:click={() => interfaceAmoledTheme.set(!$interfaceAmoledTheme)}
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
				on:click={() => interfaceDisplayThumbnailAvatars.set(!$interfaceDisplayThumbnailAvatars)}
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
				on:click={() => interfaceLowBandwidthMode.set(!$interfaceLowBandwidthMode)}
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
				on:click={() => interfaceSearchSuggestionsStore.set(!$interfaceSearchSuggestionsStore)}
			/>
			<span></span>
		</label>
	</nav>
</div>

<div class="field no-margin">
	<nav class="no-padding">
		<div class="max">
			<div>{$_('layout.previewVideoOnHover')}</div>
		</div>
		<label class="switch">
			<input
				type="checkbox"
				bind:checked={$interfacePreviewVideoOnHoverStore}
				on:click={() => interfacePreviewVideoOnHoverStore.set(!$interfacePreviewVideoOnHoverStore)}
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
				on:click={() => interfaceAutoExpandDesc.set(!$interfaceAutoExpandDesc)}
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
				on:click={() => interfaceAutoExpandComments.set(!$interfaceAutoExpandComments)}
			/>
			<span></span>
		</label>
	</nav>
</div>

<div class="field label suffix border">
	<select name="region" bind:value={region} on:change={() => interfaceRegionStore.set(region)}>
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
	<select name="case" bind:value={forceCase} on:change={() => interfaceForceCase.set(forceCase)}>
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
		on:change={() => interfaceDefaultPage.set(defaultPage)}
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
			on:click={async () => await Clipboard.write({ string: bookmarkletSaveToUrl() })}
			>{$_('copyUrl')}</button
		>
	</div>
{/if}
