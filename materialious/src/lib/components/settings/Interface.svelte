<script lang="ts">
	import { bookmarkletSaveToUrl } from '$lib/externalSettings/index';
	import { letterCase, titleCases, type TitleCase } from '$lib/letterCasing';
	import { Capacitor } from '@capacitor/core';
	import { iso31661 } from 'iso-3166';
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import { isUnrestrictedPlatform, timeout, shareURL } from '$lib/misc';
	import { getPages, type Pages } from '$lib/navPages';
	import { setInvidiousInstance, goToInvidiousLogin, invidiousLogout } from '$lib/auth';
	import {
		invidiousAuthStore,
		backendInUseStore,
		invidiousInstanceStore,
		interfaceAllowInsecureRequests,
		interfaceAndroidUseNativeShare,
		interfaceAutoExpandChapters,
		interfaceAutoExpandComments,
		interfaceAutoExpandDesc,
		interfaceDefaultPage,
		interfaceDisableAutoUpdate,
		interfaceForceCase,
		interfaceRegionStore,
		interfaceSearchHistoryEnabled,
		interfaceSearchSuggestionsStore,
		searchHistoryStore,
		watchHistoryEnabledStore,
		interfacePreserveTranslation
	} from '../../store';
	import { isOwnBackend } from '$lib/shared';
	import ComboBox from '../ComboBox.svelte';
	import { corsProxyUrl } from '$lib/fetchProxy';

	let invidiousInstance = $state(get(invidiousInstanceStore));

	let invalidInstance = $state(false);

	async function setInstance(event: Event) {
		event.preventDefault();
		invalidInstance = !(await setInvidiousInstance(invidiousInstance));

		if (invalidInstance) return;

		await timeout(100);
		location.reload();
	}

	async function setBackend(backend: string) {
		backendInUseStore.set(backend as 'ivg' | 'yt');
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
				await fetch(corsProxyUrl + 'allow-insecure-requests');
			} else {
				await fetch(corsProxyUrl + 'deny-insecure-requests');
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
	<ComboBox
		label={$_('backend')}
		defaultValue={$backendInUseStore}
		onChange={setBackend}
		options={[
			{ label: 'Invidious', value: 'ivg' },
			{ label: 'YouTube (Experimental)', value: 'yt' }
		]}
	/>

	{#if $backendInUseStore === 'ivg'}
		<form onsubmit={setInstance}>
			<nav>
				<div
					class="field prefix label surface-container-highest max"
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
				</div>
				<button class="circle">
					<i>done</i>
				</button>
			</nav>
		</form>
		{#if isOwnBackend()?.internalAuth && $invidiousInstanceStore}
			{#if !$invidiousAuthStore}
				<button class="surface-container-highest" onclick={goToInvidiousLogin}>
					<i>link</i>
					<span>{$_('linkInvidious')}</span>
				</button>
			{:else}
				<button class="surface-container-highest" onclick={invidiousLogout}>
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

<div class="field no-margin">
	<nav class="no-padding">
		<div class="max">
			<div>{$_('layout.preserveTranslation')}</div>
		</div>
		<label class="switch" tabindex="0">
			<input
				type="checkbox"
				bind:checked={$interfacePreserveTranslation}
				onclick={() => interfacePreserveTranslation.set(!$interfacePreserveTranslation)}
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

<ComboBox
	label={$_('region')}
	defaultValue={$interfaceRegionStore}
	options={iso31661.map((region) => {
		return {
			label: region.name,
			value: region.alpha2
		};
	})}
	onChange={(value) => interfaceRegionStore.set(value)}
/>

<ComboBox
	label={$_('letterCase')}
	defaultValue={$interfaceForceCase}
	options={[
		...titleCases.map((caseType) => {
			return {
				label: letterCase(`${caseType}`, caseType),
				value: caseType as string
			};
		})
	]}
	onChange={(value) => interfaceForceCase.set(value as TitleCase)}
/>

<ComboBox
	label={$_('defaultPage')}
	defaultValue={$interfaceDefaultPage}
	options={pages.map((page) => {
		return {
			label: page.name,
			value: page.href
		};
	})}
	onChange={(value) => interfaceDefaultPage.set(value)}
/>

{#if !Capacitor.isNativePlatform()}
	<div class="space"></div>
	<div class="settings">
		<h6>{$_('layout.bookmarklet')}</h6>
		<div class="space"></div>
		<button
			class="no-margin surface-container-highest"
			onclick={async () => {
				await shareURL(bookmarkletSaveToUrl());
			}}
		>
			<i>content_copy</i>
			<span>{$_('copyUrl')}</span>
		</button>
	</div>
{/if}
