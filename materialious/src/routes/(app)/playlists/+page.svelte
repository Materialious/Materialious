<script lang="ts">
	import {
		deletePersonalPlaylist,
		getPersonalPlaylists,
		postPersonalPlaylist
	} from '#lib/api/index';
	import ContentColumn from '#lib/components/layout/ContentColumn.svelte';
	import PlaylistThumbnail from '#lib/components/thumbnail/PlaylistThumbnail.svelte';
	import ui from 'beercss';
	import { isMaterialiousAccountActive, isYTBackend } from '#lib/backend';
	import { invidiousAuthStore, rawMasterKeyStore } from '#lib/store';
	import { isMaterialiousPlaylist } from '#lib/api/backend/playlist';
	import { _ } from '#lib/i18n/index';

	let { data } = $props();

	let playlists = $state(data);

	let provider = $state<'materialious' | 'invidious'>(
		isMaterialiousAccountActive() ? 'materialious' : 'invidious'
	);
	let saving = $state(false);
	let failure = $state('');
	let materialiousAvailable = $derived(!!$rawMasterKeyStore && isMaterialiousAccountActive());
	let invidiousAvailable = $derived(!!$invidiousAuthStore && !isYTBackend());
	let playlistPrivacy: 'public' | 'private' | 'unlisted' = 'public';
	let playlistTitle: string = $state('');

	function onPrivacyChange(event: Event) {
		if (!event.currentTarget) return;
		playlistPrivacy = (event.currentTarget as HTMLInputElement).value as
			'public' | 'private' | 'unlisted';
	}

	async function removePlaylistItem(playlistId: string) {
		await deletePersonalPlaylist(playlistId);
		playlists.playlists = playlists.playlists.filter((item) => {
			if (item.playlistId !== playlistId) {
				return item;
			}
		});
	}

	async function createPlaylist() {
		if (saving) return;
		saving = true;
		failure = '';
		try {
			await postPersonalPlaylist(
				playlistTitle.trim(),
				provider === 'materialious' ? 'private' : playlistPrivacy,
				{},
				provider
			);
			playlists.playlists = await getPersonalPlaylists();
			playlistTitle = '';
			await ui('#create-playlist');
		} catch (error) {
			failure = error instanceof Error ? error.message : String(error);
		} finally {
			saving = false;
		}
	}
</script>

<div class="page right active">
	<div class="space"></div>
	<div class="grid">
		{#each playlists.playlists as playlist (playlist.playlistId)}
			<ContentColumn>
				<article class="no-padding" style="height: 100%;">
					{#key playlist.playlistId}
						<PlaylistThumbnail {playlist} />
					{/key}

					<nav class="right-align padding">
						<span class="max small-text"
							>{isMaterialiousPlaylist(playlist.playlistId) ? 'Materialious' : 'Invidious'}</span
						>
						<button
							onclick={async () => await removePlaylistItem(playlist.playlistId)}
							class="tertiary"
						>
							<i>delete</i>
						</button>
					</nav>
				</article>
			</ContentColumn>
		{/each}
		<ContentColumn>
			<article style="height: 100%;display: flex;align-items: center;justify-content: center;">
				<button onclick={() => ui('#create-playlist')} class="extra">
					<i>add_circle</i>
					<span>{$_('playlist.createPlaylist')}</span>
				</button>
			</article>
		</ContentColumn>
	</div>
</div>

<dialog id="create-playlist">
	<form
		onsubmit={async (event: Event) => {
			event.preventDefault();
			await createPlaylist();
		}}
	>
		{#if materialiousAvailable}
			<div class="field label border">
				<select id="playlist-provider" bind:value={provider}>
					<option value="materialious">Materialious</option>
					{#if invidiousAvailable}<option value="invidious">Invidious</option>{/if}
				</select>
				<label for="playlist-provider">{$_('playlist.storage')}</label>
			</div>
		{/if}
		<div class="field label border">
			<input
				id="title"
				maxlength="200"
				bind:value={playlistTitle}
				required
				name="title"
				type="text"
			/>
			<label for="title">{$_('title')}</label>
		</div>
		{#if provider === 'materialious'}
			<p>{$_('playlist.encryptedPrivate')}</p>
		{:else}
			<div class="field middle-align">
				<nav>
					<label class="radio">
						<input checked onchange={onPrivacyChange} value="public" type="radio" name="privacy" />
						<span>{$_('playlist.public')}</span>
					</label>
					<label class="radio">
						<input onchange={onPrivacyChange} type="radio" value="unlisted" name="privacy" />
						<span>{$_('playlist.unlisted')}</span>
					</label>
					<label class="radio">
						<input onchange={onPrivacyChange} type="radio" value="private" name="privacy" />
						<span>{$_('playlist.private')}</span>
					</label>
				</nav>
			</div>
		{/if}
		{#if failure}<p role="alert" class="error-text">{failure}</p>{/if}
		<nav class="right-align">
			<button type="button" onclick={() => ui('#create-playlist')}>{$_('cancel')}</button>
			<button
				type="submit"
				disabled={saving ||
					!playlistTitle.trim() ||
					(provider === 'materialious' ? !materialiousAvailable : !invidiousAvailable)}
				>{$_('create')}</button
			>
		</nav>
	</form>
</dialog>
