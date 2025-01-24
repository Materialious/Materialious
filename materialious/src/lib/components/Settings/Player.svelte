<script lang="ts">
	import { titleCase } from '$lib/letterCasing';
	import { Capacitor } from '@capacitor/core';
	import ISO6391 from 'iso-639-1';
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import {
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
		silenceSkipperStore
	} from '../../store';

	let defaultLanguage = get(playerDefaultLanguage);

	const languageNames = ISO6391.getAllCodes().map((code) =>
		ISO6391.getName(code).toLocaleLowerCase()
	);
</script>

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
				on:click={() => playerAutoplayNextByDefaultStore.set(!$playerAutoplayNextByDefaultStore)}
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
