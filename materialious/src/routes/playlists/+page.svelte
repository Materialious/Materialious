<script lang="ts">
	import { deletePersonalPlaylist, getPersonalPlaylists, postPersonalPlaylist } from '$lib/Api';
	import PlaylistThumbnail from '$lib/PlaylistThumbnail.svelte';
	import { activePage } from '../../store';

	export let data;

	activePage.set('playlists');

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
		ui('#create-playlist');
		data.playlists = await getPersonalPlaylists();
	}
</script>

<div class="page right active">
	<div class="space"></div>
	<div class="grid">
		{#each data.playlists as playlist}
			<div class="s12 m6 l2">
				<article class="no-padding" style="height: 100%;">
					<PlaylistThumbnail {playlist} />

					<nav class="right-align padding">
						<button
							on:click={async () => await removePlaylistItem(playlist.playlistId)}
							class="tertiary square round"
						>
							<i>delete</i>
						</button>
					</nav>
				</article>
			</div>
		{/each}
		<div class="s12 m6 l2">
			<article style="height: 100%;display: flex;align-items: center;justify-content: center;">
				<button data-ui="#create-playlist" class="round extra">
					<i>add_circle</i>
					<span>Create playlist</span>
				</button>
			</article>
		</div>
	</div>
</div>

<dialog id="create-playlist">
	<form on:submit|preventDefault={createPlaylist}>
		<div class="field label border">
			<input bind:value={playlistTitle} required name="title" type="text" />
			<label for="title">Title</label>
		</div>
		<div class="field middle-align">
			<nav>
				<label class="radio">
					<input checked on:change={onPrivacyChange} value="public" type="radio" name="privacy" />
					<span>Public</span>
				</label>
				<label class="radio">
					<input on:change={onPrivacyChange} type="radio" value="unlisted" name="privacy" />
					<span>Unlisted</span>
				</label>
				<label class="radio">
					<input on:change={onPrivacyChange} type="radio" value="private" name="privacy" />
					<span>Private</span>
				</label>
			</nav>
		</div>
		<nav class="right-align">
			<button type="button" data-ui="#create-playlist">Cancel</button>
			<button type="submit">Create</button>
		</nav>
	</form>
</dialog>
