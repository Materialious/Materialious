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
	const unsubscribers = accountStores.map((store) => store.subscribe(() => controller?.abort()));
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
{:else}
	<p>{$_('playlistImport.signIn')}</p>
{/if}

<div class="space"></div>
