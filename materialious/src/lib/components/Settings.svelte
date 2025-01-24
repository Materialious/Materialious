<script lang="ts">
	import { goto } from '$app/navigation';
	import { bookmarkletSaveToUrl } from '$lib/externalSettings';
	import { Clipboard } from '@capacitor/clipboard';
	import { Capacitor } from '@capacitor/core';
	import ui from 'beercss';
	import { iso31661 } from 'iso-3166';
	import ISO6391 from 'iso-639-1';
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import { ensureNoTrailingSlash, letterCase, titleCase, titleCases } from '../misc';
	import { getPages } from '../navPages';
	import {
		authStore,
		darkModeStore,
		deArrowEnabledStore,
		deArrowInstanceStore,
		deArrowThumbnailInstanceStore,
		deArrowTitlesOnly,
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
		playerAlwaysLoopStore,
		playerAndroidBgPlayer,
		playerAndroidLockOrientation,
		playerAutoPlayStore,
		playerAutoplayNextByDefaultStore,
		playerDefaultLanguage,
		playerListenByDefaultStore,
		playerMiniPlayerStore,
		playerProxyVideosStore,
		playerSavePlaybackPositionStore,
		playerTheatreModeByDefaultStore,
		playerYouTubeJsAlways,
		playerYouTubeJsFallback,
		returnYTDislikesInstanceStore,
		returnYtDislikesStore,
		silenceSkipperStore,
		sponsorBlockCategoriesStore,
		sponsorBlockDisplayToastStore,
		sponsorBlockStore,
		sponsorBlockTimelineStore,
		sponsorBlockUrlStore,
		synciousInstanceStore,
		synciousStore,
		themeColorStore
	} from '../store';
	import { setAmoledTheme } from '../theme';

	let sponsorCategoriesList: string[] = [];
	sponsorBlockCategoriesStore.subscribe((value) => (sponsorCategoriesList = value));

	let sponsorBlockInstance = get(sponsorBlockUrlStore);
	let synciousInstance = get(synciousInstanceStore);
	let returnYTInstance = get(returnYTDislikesInstanceStore);
	let invidiousInstance = get(instanceStore);
	let deArrowUrl = get(deArrowInstanceStore);
	let deArrowThumbnailUrl = get(deArrowThumbnailInstanceStore);
	let region = get(interfaceRegionStore);
	let forceCase = get(interfaceForceCase);
	let defaultLanguage = get(playerDefaultLanguage);
	let defaultPage = get(interfaceDefaultPage);

	const languageNames = ISO6391.getAllCodes().map((code) =>
		ISO6391.getName(code).toLocaleLowerCase()
	);

	const sponsorCategories = [
		{ name: $_('layout.sponsors.sponsor'), category: 'sponsor' },
		{ name: $_('layout.sponsors.unpaidSelfPromotion'), category: 'selfpromo' },
		{ name: $_('layout.sponsors.interactionReminder'), category: 'interaction' },
		{ name: $_('layout.sponsors.intermissionIntroAnimation'), category: 'intro' },
		{ name: $_('layout.sponsors.credits'), category: 'outro' },
		{ name: $_('layout.sponsors.preViewRecapHook'), category: 'preview' },
		{ name: $_('layout.sponsors.tangentJokes'), category: 'filler' }
	];

	function toggleSponsor(category: string) {
		if (sponsorCategoriesList.includes(category)) {
			sponsorBlockCategoriesStore.set(sponsorCategoriesList.filter((value) => value !== category));
		} else {
			sponsorCategoriesList.push(category);
			sponsorBlockCategoriesStore.set(sponsorCategoriesList);
		}
	}

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

	let activeTab:
		| 'interface'
		| 'player'
		| 'data'
		| 'ryd'
		| 'api extended'
		| 'sponsorblock'
		| 'dearrow' = 'interface';

	let dialogType = '';

	function checkWidth() {
		if (innerWidth <= 1320) {
			dialogType = 'right';
		} else {
			dialogType = '';
		}
	}

	onMount(() => {
		checkWidth();

		addEventListener('resize', () => checkWidth());

		// Set default language if not set already based off browser.
		if (!get(playerDefaultLanguage)) {
			const languageCode = navigator.language || navigator.languages[0];
			const languageName = ISO6391.getName(languageCode.split('-')[0]);
			if (languageName) {
				playerDefaultLanguage.set(languageName.toLowerCase());
			}
		}
	});
</script>

<dialog id="dialog-settings" class={dialogType}>
	<nav style="margin-bottom: 1em;">
		<h4 class="max">{$_('layout.settings')}</h4>
		<button class="circle transparent" data-ui="#dialog-settings"><i>close</i></button>
	</nav>

	<div>
		<nav class="tabbed small">
			<a class:active={activeTab === 'interface'} on:click={() => (activeTab = 'interface')}>
				<i>grid_view</i>
				<span>{$_('layout.interface')}</span>
			</a>
			<a class:active={activeTab === 'player'} on:click={() => (activeTab = 'player')}>
				<i>smart_display</i>
				<span>{$_('layout.player.title')}</span>
			</a>
			<a class:active={activeTab === 'data'} on:click={() => (activeTab = 'data')}>
				<i>save</i>
				<span>{$_('layout.dataPreferences.dataPreferences')}</span>
			</a>
			<a class:active={activeTab === 'ryd'} on:click={() => (activeTab = 'ryd')}>
				<i>thumb_down</i>
				<span>RYD</span>
			</a>
			<a class:active={activeTab === 'api extended'} on:click={() => (activeTab = 'api extended')}>
				<i>sync</i>
				<span>API Extended</span>
			</a>
			<a class:active={activeTab === 'sponsorblock'} on:click={() => (activeTab = 'sponsorblock')}>
				<i>block</i>
				<span>Sponsorblock</span>
			</a>
			<a class:active={activeTab === 'dearrow'} on:click={() => (activeTab = 'dearrow')}>
				<i>keyboard_double_arrow_down</i>
				<span>{$_('layout.deArrow.title')}</span>
			</a>
			<a href="https://github.com/sponsors/WardPearce" target="_blank" referrerpolicy="no-referrer">
				<i>favorite</i>
				<span>{$_('donate')}</span>
			</a>
			<a
				href="https://github.com/Materialious/Materialious"
				target="_blank"
				referrerpolicy="no-referrer"
			>
				<i>code</i>
				<span>GitHub</span>
			</a>
		</nav>
		<div class="page padding" class:active={activeTab === 'interface'}>
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
							on:click={() =>
								interfaceDisplayThumbnailAvatars.set(!$interfaceDisplayThumbnailAvatars)}
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
							on:click={() =>
								interfaceSearchSuggestionsStore.set(!$interfaceSearchSuggestionsStore)}
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
							on:click={() =>
								interfacePreviewVideoOnHoverStore.set(!$interfacePreviewVideoOnHoverStore)}
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
				<select
					name="region"
					bind:value={region}
					on:change={() => interfaceRegionStore.set(region)}
				>
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
				<select
					name="case"
					bind:value={forceCase}
					on:change={() => interfaceForceCase.set(forceCase)}
				>
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
							<option selected={$interfaceDefaultPage === page.href} value={page.href}
								>{page.name}</option
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
		</div>
		<div class="page padding" class:active={activeTab === 'player'}>
			<div class="margin"></div>
			<div class="field label suffix border">
				<select
					name="case"
					bind:value={defaultLanguage}
					on:change={() => playerDefaultLanguage.set(defaultLanguage)}
				>
					{#each languageNames as language}
						<option selected={$playerDefaultLanguage === language} value={language}
							>{titleCase(language)}</option
						>
					{/each}
				</select>
				<label for="case">{$_('player.defaultLanguage')}</label>
				<i>arrow_drop_down</i>
			</div>

			<div class="field no-margin">
				<nav class="no-padding">
					<div class="max">
						<div>{$_('layout.player.miniPlayer')}</div>
					</div>
					<label class="switch">
						<input
							type="checkbox"
							bind:checked={$playerMiniPlayerStore}
							on:click={() => playerMiniPlayerStore.set(!$playerMiniPlayerStore)}
						/>
						<span></span>
					</label>
				</nav>
			</div>

			<div class="field no-margin">
				<nav class="no-padding">
					<div class="max">
						<div>{$_('layout.player.autoPlay')}</div>
					</div>
					<label class="switch">
						<input
							type="checkbox"
							bind:checked={$playerAutoPlayStore}
							on:click={() => playerAutoPlayStore.set(!$playerAutoPlayStore)}
						/>
						<span></span>
					</label>
				</nav>
			</div>

			<div class="field no-margin">
				<nav class="no-padding">
					<div class="max">
						<div>{$_('layout.player.alwaysLoopVideo')}</div>
					</div>
					<label class="switch">
						<input
							type="checkbox"
							bind:checked={$playerAlwaysLoopStore}
							on:click={() => playerAlwaysLoopStore.set(!$playerAlwaysLoopStore)}
						/>
						<span></span>
					</label>
				</nav>
			</div>

			{#if Capacitor.getPlatform() === 'android'}
				<div class="field no-margin">
					<nav class="no-padding">
						<div class="max">
							<div>{$_('layout.player.backgroundPlay')}</div>
						</div>
						<label class="switch">
							<input
								type="checkbox"
								bind:checked={$playerAndroidBgPlayer}
								on:click={() => playerAndroidBgPlayer.set(!$playerAndroidBgPlayer)}
							/>
							<span></span>
						</label>
					</nav>
				</div>

				<div class="field no-margin">
					<nav class="no-padding">
						<div class="max">
							<div>{$_('layout.player.lockOrientation')}</div>
						</div>
						<label class="switch">
							<input
								type="checkbox"
								bind:checked={$playerAndroidLockOrientation}
								on:click={() => playerAndroidLockOrientation.set(!$playerAndroidLockOrientation)}
							/>
							<span></span>
						</label>
					</nav>
				</div>
			{/if}

			{#if Capacitor.isNativePlatform()}
				<div class="field no-margin">
					<nav class="no-padding">
						<div class="max">
							<div>{$_('layout.player.proxyVideos')}</div>
						</div>
						<label class="switch">
							<input
								type="checkbox"
								bind:checked={$playerProxyVideosStore}
								on:click={() => playerProxyVideosStore.set(!$playerProxyVideosStore)}
							/>
							<span></span>
						</label>
					</nav>
				</div>
			{/if}

			<div class="field no-margin">
				<nav class="no-padding">
					<div class="max">
						<div>{$_('layout.player.savePlaybackPosition')}</div>
					</div>
					<label class="switch">
						<input
							type="checkbox"
							bind:checked={$playerSavePlaybackPositionStore}
							on:click={() =>
								playerSavePlaybackPositionStore.set(!$playerSavePlaybackPositionStore)}
						/>
						<span></span>
					</label>
				</nav>
			</div>

			<div class="field no-margin">
				<nav class="no-padding">
					<div class="max">
						<div>{$_('layout.player.listenByDefault')}</div>
					</div>
					<label class="switch">
						<input
							type="checkbox"
							bind:checked={$playerListenByDefaultStore}
							on:click={() => playerListenByDefaultStore.set(!$playerListenByDefaultStore)}
						/>
						<span></span>
					</label>
				</nav>
			</div>

			<div class="field no-margin m l">
				<nav class="no-padding">
					<div class="max">
						<div>{$_('layout.player.theatreModeByDefault')}</div>
					</div>
					<label class="switch">
						<input
							type="checkbox"
							bind:checked={$playerTheatreModeByDefaultStore}
							on:click={() =>
								playerTheatreModeByDefaultStore.set(!$playerTheatreModeByDefaultStore)}
						/>
						<span></span>
					</label>
				</nav>
			</div>

			<div class="field no-margin">
				<nav class="no-padding">
					<div class="max">
						<div>{$_('layout.player.autoPlayNextByDefault')}</div>
					</div>
					<label class="switch">
						<input
							type="checkbox"
							bind:checked={$playerAutoplayNextByDefaultStore}
							on:click={() =>
								playerAutoplayNextByDefaultStore.set(!$playerAutoplayNextByDefaultStore)}
						/>
						<span></span>
					</label>
				</nav>
			</div>

			<div class="field no-margin">
				<nav class="no-padding">
					<div class="max">
						<div>{$_('layout.player.silenceSkipper')}</div>
					</div>
					<label class="switch">
						<input
							type="checkbox"
							bind:checked={$silenceSkipperStore}
							on:click={() => silenceSkipperStore.set(!$silenceSkipperStore)}
						/>
						<span></span>
					</label>
				</nav>
			</div>

			{#if Capacitor.isNativePlatform()}
				<div class="field no-margin">
					<nav class="no-padding">
						<div class="max">
							<div>{$_('layout.player.youtubeJsAlways')}</div>
						</div>
						<label class="switch">
							<input
								type="checkbox"
								bind:checked={$playerYouTubeJsAlways}
								on:click={() => playerYouTubeJsAlways.set(!$playerYouTubeJsAlways)}
							/>
							<span></span>
						</label>
					</nav>
				</div>

				<div class="field no-margin">
					<nav class="no-padding">
						<div class="max">
							<div>{$_('layout.player.youtubeJsFallback')}</div>
						</div>
						<label class="switch">
							<input
								type="checkbox"
								bind:checked={$playerYouTubeJsFallback}
								on:click={() => playerYouTubeJsFallback.set(!$playerYouTubeJsFallback)}
							/>
							<span></span>
						</label>
					</nav>
				</div>
			{/if}
		</div>
		<div class="page padding" class:active={activeTab === 'data'}>
			<p style="width: 240px;">
				<a
					href={`${get(instanceStore)}/preferences`}
					target="_blank"
					rel="noopener noreferrer"
					class="link"
				>
					{$_('layout.dataPreferences.content')}
				</a>
			</p>
		</div>
		<div class="page padding" class:active={activeTab === 'ryd'}>
			<form
				on:submit|preventDefault={() =>
					returnYTDislikesInstanceStore.set(ensureNoTrailingSlash(returnYTInstance))}
			>
				<nav>
					<div class="field label border max">
						<input bind:value={returnYTInstance} name="returnyt-instance" type="text" />
						<label for="returnyt-instance">{$_('layout.instanceUrl')}</label>
					</div>
					<button class="square round">
						<i>done</i>
					</button>
				</nav>
			</form>

			<nav class="no-padding">
				<div class="max">
					<p>{$_('enabled')}</p>
				</div>
				<label class="switch">
					<input
						bind:checked={$returnYtDislikesStore}
						on:click={() => returnYtDislikesStore.set(!$returnYtDislikesStore)}
						type="checkbox"
					/>
					<span></span>
				</label>
			</nav>
		</div>
		<div class="page padding" class:active={activeTab === 'api extended'}>
			<form
				on:submit|preventDefault={() =>
					synciousInstanceStore.set(ensureNoTrailingSlash(synciousInstance))}
			>
				<nav>
					<div class="field label border max">
						<input bind:value={synciousInstance} name="syncious-instance" type="text" />
						<label for="syncious-instance">{$_('layout.instanceUrl')}</label>
					</div>
					<button class="square round">
						<i>done</i>
					</button>
				</nav>
			</form>

			<nav class="no-padding">
				<div class="max">
					<p>{$_('enabled')}</p>
				</div>
				<label class="switch">
					<input
						bind:checked={$synciousStore}
						on:click={() => synciousStore.set(!$synciousStore)}
						type="checkbox"
					/>
					<span></span>
				</label>
			</nav>
		</div>
		<div class="page padding" class:active={activeTab === 'sponsorblock'}>
			<form
				on:submit|preventDefault={() =>
					sponsorBlockUrlStore.set(ensureNoTrailingSlash(sponsorBlockInstance))}
			>
				<nav>
					<div class="field label border max">
						<input bind:value={sponsorBlockInstance} name="sponsorblock-instance" type="text" />
						<label for="sponsorblock-instance">{$_('layout.instanceUrl')}</label>
					</div>
					<button class="square round">
						<i>done</i>
					</button>
				</nav>
			</form>

			<nav class="no-padding">
				<div class="max">
					<p>{$_('enabled')}</p>
				</div>
				<label class="switch">
					<input
						bind:checked={$sponsorBlockStore}
						on:click={() => sponsorBlockStore.set(!$sponsorBlockStore)}
						type="checkbox"
					/>
					<span></span>
				</label>
			</nav>

			<nav class="no-padding">
				<div class="max">
					<p>{$_('layout.sponsors.disableToast')}</p>
				</div>
				<label class="switch">
					<input
						bind:checked={$sponsorBlockDisplayToastStore}
						on:click={() => sponsorBlockDisplayToastStore.set(!$sponsorBlockDisplayToastStore)}
						type="checkbox"
					/>
					<span></span>
				</label>
			</nav>

			<nav class="no-padding">
				<div class="max">
					<p>{$_('layout.sponsors.disableTimeline')}</p>
				</div>
				<label class="switch">
					<input
						bind:checked={$sponsorBlockTimelineStore}
						on:click={() => sponsorBlockTimelineStore.set(!$sponsorBlockTimelineStore)}
						type="checkbox"
					/>
					<span></span>
				</label>
			</nav>

			<hr style="margin: 1em 0;" />

			<p class="bold">{$_('layout.sponsors.Catagories')}</p>

			{#each sponsorCategories as sponsor}
				<div class="field middle-align no-margin">
					<nav class="no-padding">
						<div class="max">
							<p>{sponsor.name}</p>
						</div>
						<label class="switch">
							<input
								type="checkbox"
								checked={sponsorCategoriesList.includes(sponsor.category)}
								on:click={() => toggleSponsor(sponsor.category)}
							/>
							<span></span>
						</label>
					</nav>
				</div>
			{/each}
		</div>
		<div class="page padding" class:active={activeTab === 'dearrow'}>
			<form
				on:submit|preventDefault={() => deArrowInstanceStore.set(ensureNoTrailingSlash(deArrowUrl))}
			>
				<nav>
					<div class="field label border max">
						<input bind:value={deArrowUrl} name="dearrow-instance" type="text" />
						<label for="dearrow-instance">{$_('layout.instanceUrl')}</label>
					</div>
					<button class="square round">
						<i>done</i>
					</button>
				</nav>
			</form>

			<form on:submit|preventDefault={() => deArrowThumbnailInstanceStore.set(deArrowThumbnailUrl)}>
				<nav>
					<div class="field label border max">
						<input bind:value={deArrowThumbnailUrl} name="dearrow-thumbnail-instance" type="text" />
						<label for="dearrow-thumbnail-instance"
							>{$_('layout.deArrow.thumbnailInstanceUrl')}</label
						>
					</div>
					<button class="square round">
						<i>done</i>
					</button>
				</nav>
			</form>

			<nav class="no-padding">
				<div class="max">
					<p>{$_('layout.deArrow.titleOnly')}</p>
				</div>
				<label class="switch">
					<input
						bind:checked={$deArrowTitlesOnly}
						on:click={() => deArrowTitlesOnly.set(!$deArrowTitlesOnly)}
						type="checkbox"
					/>
					<span></span>
				</label>
			</nav>

			<nav class="no-padding">
				<div class="max">
					<p>{$_('enabled')}</p>
				</div>
				<label class="switch">
					<input
						bind:checked={$deArrowEnabledStore}
						on:click={() => deArrowEnabledStore.set(!$deArrowEnabledStore)}
						type="checkbox"
					/>
					<span></span>
				</label>
			</nav>
		</div>
	</div>
</dialog>

<style>
	form {
		margin: 1em 0;
	}

	dialog {
		width: 1320px;
	}

	.tabbed > a {
		flex: none;
	}

	@media screen and (max-width: 1320px) {
		.tabbed {
			display: flex !important;
			flex-direction: column !important;
			gap: 0 !important;
			flex: 0 !important;
			margin-bottom: 1em !important;
			align-items: start !important;
			padding: 1em 0 !important;
			background-color: transparent;
			border-bottom: solid 1px var(--outline-variant);
		}

		.tabbed > a {
			font-size: 1.5rem !important;
			padding: 0.5em 0.3em !important;
			border-radius: 3em !important;
		}

		.tabbed.small {
			block-size: 100% !important;
			border-radius: 0 !important;
		}
	}
</style>
