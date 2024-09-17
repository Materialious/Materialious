<script lang="ts">
	import { bookmarkletSaveToUrl } from '$lib/externalSettings';
	import { Capacitor } from '@capacitor/core';
	import ui from 'beercss';
	import { iso31661 } from 'iso-3166';
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import { ensureNoTrailingSlash, titleCase, titleCases, truncate } from './misc';
	import {
		authStore,
		darkModeStore,
		deArrowEnabledStore,
		deArrowInstanceStore,
		deArrowThumbnailInstanceStore,
		deArrowTitlesOnly,
		instanceStore,
		interfaceAutoExpandComments,
		interfaceAutoExpandDesc,
		interfaceForceCase,
		interfacePreviewVideoOnHoverStore,
		interfaceRegionStore,
		interfaceSearchSuggestionsStore,
		playerAlwaysLoopStore,
		playerAndroidBackgroundPlayStore,
		playerAutoPlayStore,
		playerAutoplayNextByDefaultStore,
		playerDashStore,
		playerListenByDefaultStore,
		playerMiniPlayerStore,
		playerProxyVideosStore,
		playerSavePlaybackPositionStore,
		playerTheatreModeByDefaultStore,
		playerYouTubeJsFallback,
		playerYouTubeJsPoToken,
		playerYouTubeJsVisitorData,
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
	} from './store';

	let sponsorCategoriesList: string[] = [];
	sponsorBlockCategoriesStore.subscribe((value) => (sponsorCategoriesList = value));

	let sponsorBlockInstance = get(sponsorBlockUrlStore);
	let youTubeJsVisitorData = get(playerYouTubeJsVisitorData);
	let youTubeJsPoToken = get(playerYouTubeJsPoToken);
	let synciousInstance = get(synciousInstanceStore);
	let returnYTInstance = get(returnYTDislikesInstanceStore);
	let invidiousInstance = get(instanceStore);
	let deArrowUrl = get(deArrowInstanceStore);
	let deArrowThumbnailUrl = get(deArrowThumbnailInstanceStore);
	let region = get(interfaceRegionStore);
	let forceCase = get(interfaceForceCase);

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

<dialog class="right" id="dialog-settings">
	<nav>
		<h4 class="max">{$_('layout.settings')}</h4>
		<button class="circle transparent" data-ui="#dialog-settings"><i>close</i></button>
	</nav>
	<p>{$_('layout.customize')} Materialious</p>

	<div class="settings">
		<h6>{$_('layout.theme.theme')}</h6>
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
	</div>

	{#if Capacitor.isNativePlatform()}
		<div class="settings">
			<h6>Invidious</h6>
			<form
				on:submit|preventDefault={() => {
					authStore.set(null);
					instanceStore.set(ensureNoTrailingSlash(invidiousInstance));
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
		</div>
	{/if}

	<div class="settings">
		<h6>{$_('layout.interface')}</h6>

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
			<select name="region" bind:value={region} on:change={() => interfaceRegionStore.set(region)}>
				{#each iso31661 as region}
					<option selected={$interfaceRegionStore === region.alpha2} value={region.alpha2}
						>{region.alpha2} - {truncate(region.name, 13)}</option
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
						>{titleCase(`${caseType}`)}</option
					>
				{/each}
			</select>
			<label for="case">{$_('letterCase')}</label>
			<i>arrow_drop_down</i>
		</div>
	</div>

	<div class="settings">
		<h6>{$_('layout.dataPreferences.dataPreferences')}</h6>
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

	<div class="settings">
		<h6>{$_('layout.player.title')}</h6>

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

		{#if Capacitor.getPlatform() !== 'android'}
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
						on:click={() => playerSavePlaybackPositionStore.set(!$playerSavePlaybackPositionStore)}
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
						on:click={() => playerTheatreModeByDefaultStore.set(!$playerTheatreModeByDefaultStore)}
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

		{#if Capacitor.getPlatform() === 'android'}
			<div class="field no-margin">
				<nav class="no-padding">
					<div class="max">
						<div>{$_('layout.player.backgroundPlay')}</div>
					</div>
					<label class="switch">
						<input
							type="checkbox"
							bind:checked={$playerAndroidBackgroundPlayStore}
							on:click={() =>
								playerAndroidBackgroundPlayStore.set(!$playerAndroidBackgroundPlayStore)}
						/>
						<span></span>
					</label>
				</nav>
			</div>
		{/if}

		{#if Capacitor.getPlatform() !== 'android'}
			<div class="field no-margin">
				<nav class="no-padding">
					<div class="max">
						<div>{$_('layout.player.dash')}</div>
					</div>
					<label class="switch">
						<input
							type="checkbox"
							bind:checked={$playerDashStore}
							on:click={() => playerDashStore.set(!$playerDashStore)}
						/>
						<span></span>
					</label>
				</nav>
			</div>
		{/if}

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

		{#if Capacitor.getPlatform() !== 'web'}
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

			<form
				on:submit|preventDefault={() => {
					playerYouTubeJsVisitorData.set(youTubeJsVisitorData);
				}}
			>
				<nav>
					<div class="field label border max">
						<input bind:value={youTubeJsVisitorData} name="visitor-data" type="text" />
						<label for="visitor-data">Visitor data</label>
					</div>
					<button class="square round">
						<i>done</i>
					</button>
				</nav>
			</form>

			<form
				on:submit|preventDefault={() => {
					playerYouTubeJsPoToken.set(youTubeJsPoToken);
				}}
			>
				<nav>
					<div class="field label border max">
						<input bind:value={youTubeJsPoToken} name="po-token" type="text" />
						<label for="po-token">Po token</label>
					</div>
					<button class="square round">
						<i>done</i>
					</button>
				</nav>
			</form>
		{/if}
	</div>

	<div class="settings">
		<h6>Return YT Dislikes</h6>

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

	<div class="settings">
		<h6>Syncious</h6>

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

	<div class="settings">
		<h6>Sponsorblock</h6>

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

	<div class="settings">
		<h6>{$_('layout.deArrow.title')}</h6>

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
					<label for="dearrow-thumbnail-instance">{$_('layout.deArrow.thumbnailInstanceUrl')}</label
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

	{#if !Capacitor.isNativePlatform()}
		<div class="settings">
			<h6>{$_('layout.bookmarklet')}</h6>
			<button
				class="no-margin"
				on:click={async () => await navigator.clipboard.writeText(bookmarkletSaveToUrl())}
				>{$_('copyUrl')}</button
			>
		</div>
	{/if}
</dialog>

<style>
	.settings h6 {
		margin: 1em 0 0.3em 0;
	}

	form {
		margin: 1em 0;
	}
</style>
