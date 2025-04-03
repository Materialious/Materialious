<script lang="ts">
	import { titleCase } from '$lib/letterCasing';
	import { Capacitor } from '@capacitor/core';
	import ISO6391 from 'iso-639-1';
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import {
		playerAlwaysLoopStore,
		playerAndroidLockOrientation,
		playerAutoPlayStore,
		playerAutoplayNextByDefaultStore,
		playerDefaultLanguage,
		playerProxyVideosStore,
		playerSavePlaybackPositionStore,
		playerTheatreModeByDefaultStore,
		playerYouTubeJsAlways,
		playerYouTubeJsFallback
	} from '../../store';

	let defaultLanguage = $state(get(playerDefaultLanguage));

	const languageNames = ISO6391.getAllCodes().map((code) =>
		ISO6391.getName(code).toLocaleLowerCase()
	);
</script>

<div class="margin"></div>
<div class="field label suffix border">
	<select
		name="case"
		bind:value={defaultLanguage}
		onchange={() => playerDefaultLanguage.set(defaultLanguage)}
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
			<div>{$_('layout.player.autoPlay')}</div>
		</div>
		<label class="switch">
			<input
				type="checkbox"
				bind:checked={$playerAutoPlayStore}
				onclick={() => playerAutoPlayStore.set(!$playerAutoPlayStore)}
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
				onclick={() => playerAlwaysLoopStore.set(!$playerAlwaysLoopStore)}
			/>
			<span></span>
		</label>
	</nav>
</div>

{#if Capacitor.getPlatform() === 'android'}
	<div class="field no-margin">
		<nav class="no-padding">
			<div class="max">
				<div>{$_('layout.player.lockOrientation')}</div>
			</div>
			<label class="switch">
				<input
					type="checkbox"
					bind:checked={$playerAndroidLockOrientation}
					onclick={() => playerAndroidLockOrientation.set(!$playerAndroidLockOrientation)}
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
					onclick={() => playerProxyVideosStore.set(!$playerProxyVideosStore)}
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
				onclick={() => playerSavePlaybackPositionStore.set(!$playerSavePlaybackPositionStore)}
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
				onclick={() => playerTheatreModeByDefaultStore.set(!$playerTheatreModeByDefaultStore)}
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
				onclick={() => playerAutoplayNextByDefaultStore.set(!$playerAutoplayNextByDefaultStore)}
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
					onclick={() => playerYouTubeJsAlways.set(!$playerYouTubeJsAlways)}
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
					onclick={() => playerYouTubeJsFallback.set(!$playerYouTubeJsFallback)}
				/>
				<span></span>
			</label>
		</nav>
	</div>
{/if}
