<script lang="ts">
	import { titleCase } from '$lib/letterCasing';
	import { Capacitor } from '@capacitor/core';
	import ISO6391 from 'iso-639-1';
	import { _ } from '$lib/i18n';
	import {
		backendInUseStore,
		playerAlwaysLoopStore,
		playerAndroidLockOrientation,
		playerAndroidPauseOnNetworkChange,
		playerAutoPlayStore,
		playerAutoplayNextByDefaultStore,
		playerCCByDefault,
		playerDefaultLanguage,
		playerDefaultPlaybackSpeed,
		playerDefaultQualityStore,
		playerMiniplayerEnabled,
		playerProxyVideosStore,
		playerSavePlaybackPositionStore,
		playerTheatreModeByDefaultStore,
		playerYouTubeJsAlways,
		playerYouTubeJsFallback
	} from '../../store';
	import { playbackRates } from '$lib/player/index';
	import { isUnrestrictedPlatform } from '$lib/misc';
	import ComboBox from '../ComboBox.svelte';

	let localVideoFallback: 'enabled' | 'disabled' | 'always' = $state('enabled');
	if (!$playerYouTubeJsFallback) {
		localVideoFallback = 'disabled';
	} else if ($playerYouTubeJsAlways) {
		localVideoFallback = 'always';
	}

	const languageNames = ISO6391.getAllCodes().map((code) =>
		ISO6391.getName(code).toLocaleLowerCase()
	);

	languageNames.unshift('original');

	function onLocalVideoFallbackChange(value: string) {
		switch (value) {
			case 'enabled':
				playerYouTubeJsFallback.set(true);
				playerYouTubeJsAlways.set(false);
				break;
			case 'disabled':
				playerYouTubeJsFallback.set(false);
				playerYouTubeJsAlways.set(false);
				break;
			case 'always':
				playerYouTubeJsAlways.set(true);
				playerYouTubeJsFallback.set(true);
				break;
		}
	}
</script>

<div class="margin"></div>
<ComboBox
	label={$_('player.defaultLanguage')}
	defaultValue={$playerDefaultLanguage}
	options={languageNames.map((language) => {
		return {
			label: titleCase(language),
			value: language
		};
	})}
	onChange={(value) => playerDefaultLanguage.set(value)}
/>

<ComboBox
	label={$_('player.preferredQuality')}
	defaultValue={$playerDefaultQualityStore}
	onChange={(value) => playerDefaultQualityStore.set(value)}
	options={[
		{ label: 'Auto (Recommended)', value: 'auto' },
		{ label: '144p (Ultra low)', value: '144' },
		{ label: '240p (Low)', value: '240' },
		{ label: '360p (SD)', value: '360' },
		{ label: '480p (SD+)', value: '480' },
		{ label: '720p (HD)', value: '720' },
		{ label: '1080p (Full HD)', value: '1080' },
		{ label: '1440p (2K)', value: '1440' },
		{ label: '2160p (4K UHD)', value: '2160' }
	]}
/>

<ComboBox
	label={$_('layout.player.defaultPlaybackSpeed')}
	defaultValue={$playerDefaultPlaybackSpeed.toString()}
	options={playbackRates.map((rate) => {
		return {
			label: `x${rate}`,
			value: rate.toString()
		};
	})}
	onChange={(value) => playerDefaultPlaybackSpeed.set(Number(value))}
/>

{#if isUnrestrictedPlatform() && $backendInUseStore === 'ivg'}
	<ComboBox
		label={$_('layout.player.localVideoFallback')}
		defaultValue={localVideoFallback}
		options={[
			{ label: $_('enabled'), value: 'enabled' },
			{ label: $_('layout.player.youtubeJsAlways'), value: 'always' },
			{ label: $_('disabled'), value: 'disabled' }
		]}
		onChange={(value) => onLocalVideoFallbackChange(value)}
	/>
{/if}

<div class="space"></div>

<div class="field no-margin">
	<nav class="no-padding">
		<div class="max">
			<div>{$_('layout.player.ccByDefault')}</div>
		</div>
		<label class="switch" tabindex="0">
			<input
				type="checkbox"
				bind:checked={$playerCCByDefault}
				onclick={() => playerCCByDefault.set(!$playerCCByDefault)}
				role="switch"
			/>
			<span></span>
		</label>
	</nav>
</div>

<div class="field no-margin">
	<nav class="no-padding">
		<div class="max">
			<div>{$_('layout.player.miniPlayer')}</div>
		</div>
		<label class="switch" tabindex="0">
			<input
				type="checkbox"
				bind:checked={$playerMiniplayerEnabled}
				onclick={() => playerMiniplayerEnabled.set(!$playerMiniplayerEnabled)}
				role="switch"
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
		<label class="switch" tabindex="0">
			<input
				type="checkbox"
				bind:checked={$playerAutoPlayStore}
				onclick={() => playerAutoPlayStore.set(!$playerAutoPlayStore)}
				role="switch"
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
		<label class="switch" tabindex="0">
			<input
				type="checkbox"
				bind:checked={$playerAlwaysLoopStore}
				onclick={() => playerAlwaysLoopStore.set(!$playerAlwaysLoopStore)}
				role="switch"
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
			<label class="switch" tabindex="0">
				<input
					type="checkbox"
					bind:checked={$playerAndroidLockOrientation}
					onclick={() => playerAndroidLockOrientation.set(!$playerAndroidLockOrientation)}
					role="switch"
				/>
				<span></span>
			</label>
		</nav>
	</div>

	<div class="field no-margin">
		<nav class="no-padding">
			<div class="max">
				<div>{$_('layout.player.networkChangePause')}</div>
			</div>
			<label class="switch" tabindex="0">
				<input
					type="checkbox"
					bind:checked={$playerAndroidPauseOnNetworkChange}
					onclick={() => playerAndroidPauseOnNetworkChange.set(!$playerAndroidPauseOnNetworkChange)}
					role="switch"
				/>
				<span></span>
			</label>
		</nav>
	</div>
{/if}

{#if isUnrestrictedPlatform()}
	<div class="field no-margin">
		<nav class="no-padding">
			<div class="max">
				<div>{$_('layout.player.proxyVideos')}</div>
			</div>
			<label class="switch" tabindex="0">
				<input
					type="checkbox"
					bind:checked={$playerProxyVideosStore}
					onclick={() => playerProxyVideosStore.set(!$playerProxyVideosStore)}
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
			<div>{$_('layout.player.savePlaybackPosition')}</div>
		</div>
		<label class="switch" tabindex="0">
			<input
				type="checkbox"
				bind:checked={$playerSavePlaybackPositionStore}
				onclick={() => playerSavePlaybackPositionStore.set(!$playerSavePlaybackPositionStore)}
				role="switch"
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
		<label class="switch" tabindex="0">
			<input
				type="checkbox"
				bind:checked={$playerTheatreModeByDefaultStore}
				onclick={() => playerTheatreModeByDefaultStore.set(!$playerTheatreModeByDefaultStore)}
				role="switch"
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
		<label class="switch" tabindex="0">
			<input
				type="checkbox"
				bind:checked={$playerAutoplayNextByDefaultStore}
				onclick={() => playerAutoplayNextByDefaultStore.set(!$playerAutoplayNextByDefaultStore)}
				role="switch"
			/>
			<span></span>
		</label>
	</nav>
</div>
