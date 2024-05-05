<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { peerJs, removeWindowQueryFlag, setWindowQueryFlag } from '$lib/misc';
	import type { PlayerEvents } from '$lib/player';
	import type { DataConnection } from 'peerjs';
	import { onDestroy, onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import { syncPartyConnectionsStore, syncPartyPeerStore } from '../store';

	function changeVideoEvent(conn: DataConnection) {
		conn.on('data', (data) => {
			const events = data as PlayerEvents;
			const currentUrl = get(page).url;

			events.events.forEach((event) => {
				if (event.type === 'change-video' && event.videoId) {
					currentUrl.pathname = `/watch/${event.videoId}`;
					goto(currentUrl);
				}
			});
		});
	}

	async function startWatchSync() {
		if ($syncPartyPeerStore) {
			$syncPartyPeerStore.destroy();
			syncPartyPeerStore.set(null);
			removeWindowQueryFlag('sync');
			return;
		}

		const peerId = crypto.randomUUID();
		setWindowQueryFlag('sync', peerId);
		$syncPartyPeerStore = peerJs(peerId);

		if ($syncPartyPeerStore) {
			$syncPartyPeerStore.on('connection', (conn) => {
				conn.on('open', async () => {
					await ui('#sync-party-connection-join');

					if ($page.url.pathname.startsWith('/watch')) {
						const paths = $page.url.pathname.split('/');
						if (paths.length > 2) {
							conn.send({
								events: [
									{
										type: 'change-video',
										videoId: paths[2]
									}
								]
							} as PlayerEvents);
						}
					}
					changeVideoEvent(conn);
					syncPartyConnectionsStore.set([...($syncPartyConnectionsStore || []), conn]);
				});

				conn.on('close', async () => {
					await ui('#sync-party-connection-left');
				});
			});
		}
	}

	onMount(async () => {
		const currentUrl = get(page).url;
		const syncId = currentUrl.searchParams.get('sync');
		if (syncId) {
			$syncPartyPeerStore = peerJs(crypto.randomUUID());
			$syncPartyPeerStore.on('open', () => {
				if (!$syncPartyPeerStore) return;

				const conn = $syncPartyPeerStore.connect(syncId);
				syncPartyConnectionsStore.set([...($syncPartyConnectionsStore || []), conn]);

				changeVideoEvent(conn);
			});

			$syncPartyPeerStore.on('disconnected', () => {
				syncPartyPeerStore.set(null);
				syncPartyConnectionsStore.set(null);
			});
		}
	});

	onDestroy(() => {
		if ($syncPartyPeerStore) {
			$syncPartyPeerStore.destroy();
			$syncPartyPeerStore = null;
		}
	});
</script>

<dialog id="sync-party">
	<h6>{$_('layout.syncParty')}</h6>
	<p>{$_('layout.syncPartyWarning')}</p>
	{#if $syncPartyPeerStore}
		<nav>
			<div class="field label border max">
				<input
					name="sync-share"
					readonly
					value={`${location.origin}?sync=${$syncPartyPeerStore.id}`}
					type="text"
				/>
				<label class="active" for="sync-share">Share URL</label>
			</div>
			<button
				on:click={async () => {
					await navigator.clipboard.writeText(`${location.origin}?sync=${$syncPartyPeerStore?.id}`);
				}}
				class="square round"
			>
				<i>content_copy</i>
			</button>
		</nav>
	{/if}
	<div class="space"></div>
	<button
		class="no-margin"
		on:click={startWatchSync}
		data-ui={`${$syncPartyPeerStore ? '#sync-party' : ''}`}
		>{#if $syncPartyPeerStore}
			{$_('layout.endSyncParty')}
		{:else}
			{$_('layout.startSyncParty')}
		{/if}
	</button>
</dialog>

<div class="snackbar" id="sync-party-connection-join">
	<i>person_add</i>
	<span>{$_('syncParty.userJoined')}</span>
</div>

<div class="snackbar" id="sync-party-connection-left">
	<i>person_remove</i>
	<span>{$_('syncParty.userLeft')}</span>
</div>
