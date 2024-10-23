<script lang="ts">
	import { deletePersonalPlaylist, getPersonalPlaylists, postPersonalPlaylist } from '$lib/Api';
	import ContentColumn from '$lib/ContentColumn.svelte';
	import PlaylistThumbnail from '$lib/PlaylistThumbnail.svelte';
	import { activePageStore } from '$lib/store';
	import { _ } from 'svelte-i18n';

	export let data;

	activePageStore.set('playlists');

	let playlistPrivacy: 'public' | 'private' | 'unlisted' = 'public';
	let playlistTitle: string;

	function onPrivacyChange(event: any) {
		playlistPrivacy = event.currentTarget.value;
	}

	async function removePlaylistItem(playlistId: string) {
		await deletePersonalPlaylist(playlistId);
		data.playlists = data.playlists.filter((item) => {
			if (item.playlistId !== playlistId) {
				return item;
			}
		});
	}

	async function createPlaylist() {
		await postPersonalPlaylist(playlistTitle, playlistPrivacy);
		await ui('#create-playlist');
		data.playlists = await getPersonalPlaylists();
	}
</script>

<div class="page right active">
	<div class="space"></div>
	<div class="grid">
		{#each data.playlists as playlist}
			<ContentColumn>
				<article class="no-padding" style="height: 100%;">
					<PlaylistThumbnail disabled={playlist.videoCount === 0} {playlist} />

					<nav class="right-align padding">
						<button
							on:click={async () => await removePlaylistItem(playlist.playlistId)}
							class="tertiary square round"
						>
							<i>delete</i>
						</button>
					</nav>
				</article>
			</ContentColumn>
		{/each}
		<ContentColumn>
			<article style="height: 100%;display: flex;align-items: center;justify-content: center;">
				<button on:click={() => ui('#create-playlist')} class="round extra">
					<i>add_circle</i>
					<span>{$_('playlist.createPlaylist')}</span>
				</button>
			</article>
		</ContentColumn>
	</div>
</div>

<dialog id="create-playlist">
	<form on:submit|preventDefault={createPlaylist}>
		<div class="field label border">
			<input bind:value={playlistTitle} required name="title" type="text" />
			<label for="title">{$_('title')}</label>
		</div>
		<div class="field middle-align">
			<nav>
				<label class="radio">
					<input checked on:change={onPrivacyChange} value="public" type="radio" name="privacy" />
					<span>{$_('playlist.public')}</span>
				</label>
				<label class="radio">
					<input on:change={onPrivacyChange} type="radio" value="unlisted" name="privacy" />
					<span>{$_('playlist.unlisted')}</span>
				</label>
				<label class="radio">
					<input on:change={onPrivacyChange} type="radio" value="private" name="privacy" />
					<span>{$_('playlist.private')}</span>
				</label>
			</nav>
		</div>
		<nav class="right-align">
			<button type="button" on:click={() => ui('#create-playlist')}>{$_('cancel')}</button>
			<button type="submit">{$_('create')}</button>
		</nav>
	</form>
</dialog>
