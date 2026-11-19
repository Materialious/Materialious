<script lang="ts">
	import { onDestroy } from 'svelte';
	import { get, type Readable } from 'svelte/store';
	import { _ } from '#lib/i18n/index';
	import { isMaterialiousAccountActive, isYTBackend } from '#lib/backend';
	import { addPlaylistVideo, postPersonalPlaylist, invalidatePersonalPlaylists } from '#lib/api';
	import {
		authTokenStore,
		backendInUseStore,
		invidiousAuthStore,
		invidiousInstanceStore,
		materialiousBackendStore,
		rawMasterKeyStore
	} from '#lib/store';
	import { configBackendCache } from '#lib/stores/backend';
	import { importPlaylists, parsePlaylistFile, type ImportedPlaylist } from '#lib/playlistImport';
	import { addToast, toaster } from '../Toast.svelte';
	import { getPersonalPlaylistsBackend, getPlaylistBackend } from '#lib/api/backend/playlist';
	import { getPersonalPlaylistsInvidious, getPlaylistInvidious } from '#lib/api/invidious/playlist';
	import type { PlaylistPage } from '#lib/api/model';
	import { playlistToYouTubeCsv, playlistExportFilename } from '#lib/playlistExport';
	import { downloadStringAsFile } from '#lib/download';

	let materialiousAvailable = $derived(
		!!$rawMasterKeyStore &&
			($materialiousBackendStore
				? !!$configBackendCache?.internalAuth
				: isMaterialiousAccountActive())
	);
	let provider = $derived<'materialious' | 'invidious'>(
		materialiousAvailable ? 'materialious' : 'invidious'
	);
	let invidiousAvailable = $derived(
		($backendInUseStore !== 'yt' || !isYTBackend()) &&
			!!$invidiousAuthStore &&
			!!$invidiousInstanceStore
	);
	let busy = $state(false);
	let reading = $state(false);
	let controller: AbortController | undefined;
	let disposed = false;
	let exportDialog = $state<HTMLDialogElement>();
	let exportPlaylists = $state<PlaylistPage[]>([]);
	let exportPlaylistId = $state('');
	const importToastId = `playlist-import-${Math.random().toString(36).slice(2)}`;
	const accountStores: Readable<unknown>[] = [
		authTokenStore,
		backendInUseStore,
		invidiousAuthStore,
		invidiousInstanceStore,
		materialiousBackendStore,
		configBackendCache,
		rawMasterKeyStore
	];
	const unsubscribers = accountStores.map((store) =>
		store.subscribe(() => {
			controller?.abort();
			exportDialog?.close();
			exportPlaylists = [];
		})
	);
	onDestroy(() => {
		disposed = true;
		controller?.abort();
		toaster.removeToast(importToastId);
		unsubscribers.forEach((unsubscribe) => unsubscribe());
	});

	async function selectFiles(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		input.value = '';
		if (!files.length || busy || reading) return;
		const destination = provider;
		const account = accountStores.map((store) => get(store));
		reading = true;
		try {
			const parsed = await Promise.all(
				files.map(async (file) => parsePlaylistFile(await file.text(), file.name))
			);
			if (disposed) return;
			if (accountStores.some((store, index) => get(store) !== account[index]))
				throw new Error($_('playlistImport.accountChanged'));
			reading = false;
			await startImport(parsed.flat(), destination);
		} catch (failure) {
			addToast({ data: { text: String(failure), icon: 'error' } });
		} finally {
			reading = false;
		}
	}

	async function startImport(
		playlists: ImportedPlaylist[],
		destination: 'materialious' | 'invidious'
	) {
		if (busy || disposed || !playlists.length) return;
		if (destination === 'materialious' ? !materialiousAvailable : !invidiousAvailable) {
			addToast({ data: { text: $_('playlistImport.signIn'), icon: 'error' } });
			return;
		}
		const account = accountStores.map((store) => get(store));
		const activeController = new AbortController();
		controller = activeController;
		busy = true;
		let failed = false;
		addToast({
			id: importToastId,
			data: { text: $_('playlistImport.importing'), icon: 'hourglass_top' },
			closeDelay: 0
		});
		const checkAccount = () => {
			if (
				activeController.signal.aborted ||
				accountStores.some((store, index) => get(store) !== account[index])
			)
				throw new Error($_('playlistImport.accountChanged'));
		};
		try {
			const results = await importPlaylists(playlists, {
				create: (title) =>
					postPersonalPlaylist(title, 'private', { signal: activeController.signal }, destination),
				add: (id, videoId) => addPlaylistVideo(id, videoId, { signal: activeController.signal }),
				checkAccount,
				signal: activeController.signal
			});
			failed =
				activeController.signal.aborted ||
				results.some((result) => result.status !== 'complete' || result.failures.length > 0);
		} catch {
			failed = true;
		} finally {
			toaster.removeToast(importToastId);
			addToast({
				data: {
					text: $_(failed ? 'playlistImport.incomplete' : 'playlistImport.finished'),
					icon: failed ? 'error' : 'done'
				}
			});
			invalidatePersonalPlaylists();
			controller = undefined;
			busy = false;
		}
	}

	async function chooseExportPlaylist() {
		if (busy || reading || disposed) return;
		const destination = provider;
		const activeController = new AbortController();
		controller = activeController;
		busy = true;
		try {
			exportPlaylists = await (destination === 'materialious'
				? getPersonalPlaylistsBackend({ signal: activeController.signal })
				: getPersonalPlaylistsInvidious({ signal: activeController.signal }));
			if (disposed || activeController.signal.aborted) return;
			if (!exportPlaylists.length) {
				addToast({ data: { text: $_('player.noPlaylists') } });
				return;
			}
			exportPlaylistId = exportPlaylists[0].playlistId;
			exportDialog?.showModal();
		} catch (failure) {
			addToast({ data: { text: String(failure), icon: 'error' } });
		} finally {
			controller = undefined;
			busy = false;
		}
	}

	async function exportPlaylist() {
		const playlist = exportPlaylists.find((playlist) => playlist.playlistId === exportPlaylistId);
		if (busy || disposed || !playlist) return;
		const destination = provider;
		const activeController = new AbortController();
		controller = activeController;
		busy = true;
		exportDialog?.close();
		addToast({ id: importToastId, data: { text: $_('playlistExport.exporting') }, closeDelay: 0 });
		try {
			const loadPage = destination === 'materialious' ? getPlaylistBackend : getPlaylistInvidious;
			const csv = await playlistToYouTubeCsv((page) =>
				loadPage(playlist.playlistId, page, { signal: activeController.signal })
			);
			if (disposed || activeController.signal.aborted) return;
			if (await downloadStringAsFile(csv, playlistExportFilename(playlist.title))) {
				addToast({ data: { text: $_('playlistExport.finished'), icon: 'done' } });
			}
		} catch (failure) {
			addToast({ data: { text: String(failure), icon: 'error' } });
		} finally {
			toaster.removeToast(importToastId);
			controller = undefined;
			busy = false;
		}
	}
</script>

<h3>{$_('pages.playlists')}</h3>
<p>{$_('playlistImport.supported')}</p>

{#if materialiousAvailable || invidiousAvailable}
	<div class="field label border">
		<select id="playlist-import-provider" bind:value={provider} disabled={busy || reading}>
			<option value="materialious" disabled={!materialiousAvailable}>Materialious</option>
			<option value="invidious" disabled={!invidiousAvailable}>Invidious</option>
		</select>
		<label for="playlist-import-provider">{$_('playlist.storage')}</label>
	</div>
	<div class="space"></div>
	<label class="button surface-container-highest">
		<i>attach_file</i>
		<span>{$_('playlistImport.selectFiles')}</span>
		<input
			type="file"
			accept=".csv,.json,.db"
			multiple
			disabled={busy ||
				reading ||
				(provider === 'materialious' ? !materialiousAvailable : !invidiousAvailable)}
			onchange={selectFiles}
		/>
	</label>
	<div class="space"></div>
	<button
		class="surface-container-highest"
		onclick={chooseExportPlaylist}
		disabled={busy ||
			reading ||
			(provider === 'materialious' ? !materialiousAvailable : !invidiousAvailable)}
	>
		<i>file_export</i><span>{$_('playlistExport.title')}</span>
	</button>
{:else}
	<p>{$_('playlistImport.signIn')}</p>
{/if}

<dialog bind:this={exportDialog} class="padding" aria-labelledby="playlist-export-title">
	<h6 id="playlist-export-title">{$_('playlistExport.title')}</h6>
	<div class="field label border">
		<select id="playlist-export-selection" bind:value={exportPlaylistId}>
			{#each exportPlaylists as playlist (playlist.playlistId)}
				<option value={playlist.playlistId}>{playlist.title}</option>
			{/each}
		</select>
		<label for="playlist-export-selection">{$_('playlistExport.playlist')}</label>
	</div>
	<nav class="right-align">
		<button class="transparent" onclick={() => exportDialog?.close()}
			>{$_('playlistExport.cancel')}</button
		>
		<button onclick={exportPlaylist} disabled={busy || !exportPlaylistId}
			>{$_('playlistExport.download')}</button
		>
	</nav>
</dialog>
<div class="space"></div>
