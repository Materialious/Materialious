<script lang="ts">
	import { goto, pushState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { _ } from '$lib/i18n';
	import { playerState } from '$lib/store';
	import { getMaterialiousBackendUrl } from '$lib/backend';
	import sodium from 'libsodium-wrappers-sumo';
	import { onDestroy, onMount } from 'svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { watchPartyEventSchema, type WatchPartyEvent } from '$lib/watchParty';

	let room: { id: string; source: EventSource; clientId?: string } | undefined = $state();
	let creating = $state(false);

	onMount(() => joinRoomFromUrl());

	onDestroy(() => {
		room?.source.close();
	});

	function isHello(payload: unknown): payload is { event: 'hello'; clientId: string } {
		return (
			typeof payload === 'object' &&
			payload !== null &&
			(payload as { event?: unknown }).event === 'hello' &&
			typeof (payload as { clientId?: unknown }).clientId === 'string'
		);
	}

	function connect(roomId: string) {
		const source = new EventSource(`${getMaterialiousBackendUrl()}/api/watchParty/${roomId}`);

		source.onmessage = (event) => {
			let payload: unknown;
			try {
				payload = JSON.parse(event.data);
			} catch {
				return;
			}

			if (isHello(payload)) {
				room = { id: roomId, source, clientId: payload.clientId };
				return;
			}

			handleActionData(payload);
		};

		room = { id: roomId, source };
	}

	function handleActionData(data: unknown) {
		const dataParsed = watchPartyEventSchema.safeParse(data);
		if (!dataParsed.success) return;

		if (dataParsed.data.event === 'goToVideo') {
			goto(resolve('/watch/[videoId]', { videoId: dataParsed.data.videoId }));
			return;
		}

		const player = $playerState;
		if (!player?.playerElement) return;

		const playerElement = player.playerElement;

		const duration = playerElement.duration;
		const targetTime = Number.isFinite(duration)
			? Math.max(0, Math.min(dataParsed.data.currentTime, duration))
			: Math.max(0, dataParsed.data.currentTime);

		switch (dataParsed.data.event) {
			case 'play':
				if (Math.abs(playerElement.currentTime - targetTime) > 2) {
					playerElement.currentTime = targetTime;
				}
				playerElement.play();
				break;
			case 'pause':
				if (Math.abs(playerElement.currentTime - targetTime) > 0.5) {
					playerElement.currentTime = targetTime;
				}
				playerElement.pause();
				break;
			case 'seek':
				playerElement.currentTime = targetTime;
				break;
		}
	}

	function sendEvent(message: WatchPartyEvent) {
		const currentRoom = room;
		if (!currentRoom) return;

		fetch(`${getMaterialiousBackendUrl()}/api/watchParty/${currentRoom.id}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...message, clientId: currentRoom.clientId })
		});
	}

	async function createRoom() {
		if (creating) return;
		creating = true;
		try {
			await sodium.ready;

			const roomId = sodium.to_base64(
				sodium.randombytes_buf(24),
				sodium.base64_variants.URLSAFE_NO_PADDING
			);

			connect(roomId);

			const currentSearchParams = new SvelteURLSearchParams(window.location.search);
			currentSearchParams.set('room', roomId);

			pushState(`?${currentSearchParams.toString()}`, { replaceState: false });
		} finally {
			creating = false;
		}
	}

	function joinRoomFromUrl() {
		const givenRoomId = page.url.searchParams.get('room');

		if (!givenRoomId) return;

		connect(givenRoomId);
	}

	function leaveRoom() {
		room?.source.close();
		room = undefined;

		const currentSearchParams = new SvelteURLSearchParams(window.location.search);
		currentSearchParams.delete('room');

		pushState(`?${currentSearchParams.toString()}`, { replaceState: false });
	}

	let attachedPlayerElement: HTMLMediaElement | undefined;

	$effect(() => {
		const player = $playerState;
		const playerElement = player?.playerElement;
		if (!playerElement) return;

		if (attachedPlayerElement === playerElement) return;
		attachedPlayerElement = playerElement;

		let lastSent: { event: WatchPartyEvent['event']; time: number; at: number } | undefined;

		function sendPlayerEvent(event: WatchPartyEvent['event']) {
			if (!room || !playerElement || !player?.data?.video?.videoId) return;

			const currentTime = playerElement.currentTime;
			const now = Date.now();

			if (
				lastSent?.event === event &&
				Math.abs(lastSent.time - currentTime) < 1 &&
				now - lastSent.at < 1000
			) {
				return;
			}

			lastSent = { event, time: currentTime, at: now };

			sendEvent({
				event,
				videoId: player.data.video.videoId,
				sent: new Date().toISOString(),
				currentTime
			});
		}

		const onPlay = () => sendPlayerEvent('play');
		const onPause = () => sendPlayerEvent('pause');
		const onSeeked = () => sendPlayerEvent('seek');
		const onWaiting = () => sendPlayerEvent('pause');
		const onError = () => sendPlayerEvent('pause');

		playerElement.addEventListener('play', onPlay);
		playerElement.addEventListener('pause', onPause);
		playerElement.addEventListener('seeked', onSeeked);
		playerElement.addEventListener('waiting', onWaiting);
		playerElement.addEventListener('error', onError);

		return () => {
			playerElement.removeEventListener('play', onPlay);
			playerElement.removeEventListener('pause', onPause);
			playerElement.removeEventListener('seeked', onSeeked);
			playerElement.removeEventListener('waiting', onWaiting);
			playerElement.removeEventListener('error', onError);

			if (attachedPlayerElement === playerElement) attachedPlayerElement = undefined;
		};
	});
</script>

<article>
	<h4>{$_('watchParty.header')}</h4>

	{#if !room}
		<div class="space"></div>

		<button onclick={createRoom} disabled={creating} class="surface-container-highest">
			<span>{$_('watchParty.createRoom')}</span>
		</button>
	{:else}
		<div class="space"></div>
		<button onclick={leaveRoom} class="surface-container-highest">
			{$_('watchParty.leaveRoom')}
		</button>
	{/if}
</article>
