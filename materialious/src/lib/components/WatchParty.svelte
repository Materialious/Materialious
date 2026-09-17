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
	let pending: WatchPartyEvent | undefined = $state();
	let lastSentVideoId: string | undefined;
	let lastRemoteVideoId: string | undefined;
	let baselineVideoId: string | undefined;
	let suppressUntil = 0;

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

	function currentWatchVideoId(): string | undefined {
		return /\/watch\/([a-zA-Z0-9_-]{11})/.exec(page.url.pathname)?.[1];
	}

	function watchPartyUrl(videoId: string): string {
		const currentSearchParams = new SvelteURLSearchParams(window.location.search);
		if (room) currentSearchParams.set('room', room.id);
		return `${resolve('/watch/[videoId]', { videoId })}?${currentSearchParams.toString()}`;
	}

	function connect(roomId: string, announceCurrent: boolean) {
		baselineVideoId = announceCurrent ? undefined : currentWatchVideoId();

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
				suppressUntil = Date.now() + 4000;
				return;
			}

			handleActionData(payload);
		};

		room = { id: roomId, source };
	}

	function applyPlayback(playerElement: HTMLMediaElement, event: WatchPartyEvent) {
		const apply = () => {
			const duration = playerElement.duration;
			const targetTime = Number.isFinite(duration)
				? Math.max(0, Math.min(event.currentTime, duration))
				: Math.max(0, event.currentTime);

			switch (event.event) {
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
		};

		if (Number.isFinite(playerElement.duration)) {
			apply();
		} else {
			playerElement.addEventListener('loadedmetadata', apply, { once: true });
		}
	}

	function handleActionData(data: unknown) {
		const dataParsed = watchPartyEventSchema.safeParse(data);
		if (!dataParsed.success) return;

		const event = dataParsed.data;

		if (event.event === 'goToVideo') {
			lastRemoteVideoId = event.videoId;
			pending = {
				event: 'seek',
				videoId: event.videoId,
				sent: event.sent,
				currentTime: event.currentTime
			};
			suppressUntil = Math.max(suppressUntil, Date.now() + 2500);
			goto(watchPartyUrl(event.videoId));
			return;
		}

		const player = $playerState;
		const playerElement = player?.playerElement;

		if (!playerElement || player.data.video.videoId !== event.videoId) {
			pending = event;
			return;
		}

		applyPlayback(playerElement, event);
	}

	function sendGoToVideo(videoId: string) {
		if (!room?.clientId || !videoId) return;
		if (videoId === lastSentVideoId || videoId === lastRemoteVideoId) return;

		lastSentVideoId = videoId;

		const currentTime =
			$playerState?.playerElement && $playerState.data.video.videoId === videoId
				? $playerState.playerElement.currentTime
				: 0;

		sendEvent({
			event: 'goToVideo',
			videoId,
			sent: new Date().toISOString(),
			currentTime
		});
	}

	$effect(() => {
		if (!room?.clientId) return;

		const videoId = currentWatchVideoId();
		if (!videoId || videoId === baselineVideoId) return;

		sendGoToVideo(videoId);
	});

	$effect(() => {
		const player = $playerState;
		const playerElement = player?.playerElement;
		const pendingEvent = pending;

		if (!playerElement || !pendingEvent) return;
		if (pendingEvent.event === 'goToVideo' || pendingEvent.videoId !== player.data.video.videoId)
			return;

		applyPlayback(playerElement, pendingEvent);
		pending = undefined;
	});

	function sendEvent(message: WatchPartyEvent) {
		const currentRoom = room;
		if (!currentRoom?.clientId) return;

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

			connect(roomId, true);

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

		connect(givenRoomId, false);
	}

	function leaveRoom() {
		room?.source.close();
		room = undefined;
		pending = undefined;
		lastSentVideoId = undefined;
		lastRemoteVideoId = undefined;
		baselineVideoId = undefined;
		suppressUntil = 0;

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
			if (Date.now() < suppressUntil) return;

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
