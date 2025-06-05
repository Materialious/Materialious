<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { peerJs, removeWindowQueryFlag, setWindowQueryFlag } from '$lib/misc';
	import type { PlayerEvents } from '$lib/player';
	import { Clipboard } from '@capacitor/clipboard';
	import ui from 'beercss';
	import type { DataConnection } from 'peerjs';
	import { onDestroy, onMount } from 'svelte';
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import { syncPartyConnectionsStore, syncPartyPeerStore } from '../store';

	function changeVideoEvent(conn: DataConnection) {
		conn.on('data', (data) => {
			const events = data as PlayerEvents;
			const currentUrl = get(page).url;

			const blockedPages = ['subscriptions', 'playlists', 'history', 'subscriptions/manage'];

			events.events.forEach((event) => {
				if (event.type === 'change-video' && event.videoId) {
					currentUrl.pathname = `/watch/${event.videoId}`;
					goto(currentUrl);
				} else if (event.type === 'goto' && event.path && event.path !== $page.url.pathname) {
					if (blockedPages.includes(event.path.replace('/', ''))) {
						ui('#sync-party-private-page');
					} else {
						currentUrl.pathname = event.path;
						goto(currentUrl);
					}
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
		$syncPartyPeerStore = await peerJs(peerId);

		if ($syncPartyPeerStore) {
			$syncPartyPeerStore.on('connection', (conn) => {
				conn.on('open', async () => {
					await ui('#sync-party-connection-join');

					conn.send({
						events: [
							{
								type: 'goto',
								path: $page.url.pathname
							}
						]
					} as PlayerEvents);

					changeVideoEvent(conn);
					syncPartyConnectionsStore.set([...($syncPartyConnectionsStore || []), conn]);
				});

				conn.on('close', async () => {
					await ui('#sync-party-connection-left');
				});
			});
		}
	}

	page.subscribe((newPage) => {
		if (!newPage.url.pathname.startsWith('/watch') && $syncPartyPeerStore) {
			$syncPartyConnectionsStore?.forEach((conn) => {
				conn.send({
					events: [
						{
							type: 'goto',
							path: newPage.url.pathname
						}
					]
				} as PlayerEvents);
			});
		}
	});

	onMount(async () => {
		const currentUrl = get(page).url;
		const syncId = currentUrl.searchParams.get('sync');
		if (syncId) {
			$syncPartyPeerStore = await peerJs(crypto.randomUUID());
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
				onclick={async () => {
					await Clipboard.write({ string: `${location.origin}?sync=${$syncPartyPeerStore?.id}` });
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
		onclick={startWatchSync}
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

<div class="snackbar" id="sync-party-private-page">
	<i>shield_person</i>
	<span>{$_('syncParty.userOnPrivatePage')}</span>
</div>
