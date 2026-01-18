<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import {
		determinePeerJsInstance,
		peerJs,
		removeWindowQueryFlag,
		setWindowQueryFlag,
		shareURL
	} from '$lib/misc';
	import type { PlayerEvents } from '$lib/player';
	import type { DataConnection } from 'peerjs';
	import { onDestroy, onMount } from 'svelte';
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import { syncPartyConnectionsStore, syncPartyPeerStore } from '../store';
	import z from 'zod';
	import { Buffer } from 'buffer';
	import { Capacitor } from '@capacitor/core';
	import { addToast } from './Toast.svelte';

	const SyncInfo = z.object({
		host: z.string(),
		path: z.string(),
		port: z.number(),
		syncId: z.string()
	});

	let syncPartyManualInput: string = $state('');

	const syncOrigin = Capacitor.isNativePlatform() ? 'https://sync.materialio.us' : location.origin;

	function changeVideoEvent(conn: DataConnection) {
		conn.on('data', (data) => {
			const events = data as PlayerEvents;
			const currentUrl = get(page).url;

			const blockedPages = ['subscriptions', 'playlists', 'history', 'subscriptions/manage'];

			events.events.forEach((event) => {
				if (event.type === 'change-video' && event.videoId) {
					currentUrl.pathname = resolve(`/watch/[videoId]`, { videoId: event.videoId });
					// eslint-disable-next-line svelte/no-navigation-without-resolve
					goto(currentUrl);
				} else if (event.type === 'goto' && event.path && event.path !== $page.url.pathname) {
					if (blockedPages.includes(event.path.replace('/', ''))) {
						addToast({
							data: {
								text: $_('syncParty.userOnPrivatePage'),
								icon: 'shield_person'
							}
						});
					} else {
						currentUrl.pathname = event.path;
						// eslint-disable-next-line svelte/no-navigation-without-resolve
						goto(currentUrl);
					}
				}
			});
		});
	}

	function createShareBase64(): string {
		return Buffer.from(
			JSON.stringify({
				...determinePeerJsInstance(),
				syncId: $syncPartyPeerStore?.id
			}),
			'utf-8'
		).toString('base64');
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
					addToast({
						data: {
							text: $_('syncParty.userJoined'),
							icon: 'person_add'
						}
					});

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
					addToast({
						data: {
							text: $_('syncParty.userLeft'),
							icon: 'person_remove'
						}
					});
				});
			});
		}
	}

	page.subscribe((newPage) => {
		if (!newPage.url.pathname.startsWith(resolve('/watch', {})) && $syncPartyPeerStore) {
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

	async function joinSyncParty(syncInfo: string) {
		const parseInfo = SyncInfo.safeParse(
			JSON.parse(Buffer.from(syncInfo, 'base64').toString('utf-8'))
		);

		if (parseInfo.error) {
			return;
		}

		$syncPartyPeerStore = await peerJs(crypto.randomUUID(), parseInfo.data);
		$syncPartyPeerStore.on('open', () => {
			if (!$syncPartyPeerStore) return;

			const conn = $syncPartyPeerStore.connect(parseInfo.data.syncId);
			syncPartyConnectionsStore.set([...($syncPartyConnectionsStore || []), conn]);

			changeVideoEvent(conn);
		});

		$syncPartyPeerStore.on('disconnected', () => {
			syncPartyPeerStore.set(null);
			syncPartyConnectionsStore.set(null);
		});
	}

	onMount(async () => {
		const currentUrl = get(page).url;
		const syncInfo = currentUrl.searchParams.get('sync');
		if (syncInfo) {
			await joinSyncParty(syncInfo);
		}
	});

	onDestroy(() => {
		if ($syncPartyPeerStore) {
			$syncPartyPeerStore.destroy();
			$syncPartyPeerStore = null;
		}
	});
</script>

<dialog id="sync-party" class="padding">
	<h6 class="no-margin">{$_('layout.syncParty')}</h6>
	<p class="no-margin">{$_('layout.syncPartyWarning')}</p>
	{#if $syncPartyPeerStore}
		<nav>
			<div class="field label border max">
				<input
					name="sync-share"
					readonly
					value={`${syncOrigin}${resolve(`/?sync=${createShareBase64()}`, {})}`}
					type="text"
				/>
				<label class="active" for="sync-share">{$_('layout.shareURL')}</label>
			</div>
			<button
				onclick={async () => {
					await shareURL(`${syncOrigin}${resolve(`/?sync=${createShareBase64()}`, {})}`);
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

	{#if !$syncPartyPeerStore}
		<div class="space"></div>
		<hr />
		<div class="space"></div>
		<h6 class="no-margin">{$_('layout.joinSyncParty')}</h6>
		<form
			onsubmit={async (event) => {
				event.preventDefault();

				try {
					await joinSyncParty(new URL(syncPartyManualInput).searchParams.get('sync') || '');
				} catch {
					// Continue regardless of error
				}
			}}
		>
			<div class="field label border max">
				<input bind:value={syncPartyManualInput} type="text" name="sync-input" />
				<label for="sync-input">{$_('layout.shareURL')}</label>
			</div>
		</form>
	{/if}
</dialog>
