<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { _ } from '#lib/i18n/index';
	import { playerState } from '#lib/store';
	import { getMaterialiousBackendUrl } from '#lib/backend';
	import { shareURL } from '#lib/download';
	import sodium from 'libsodium-wrappers-sumo';
	import { onDestroy, onMount } from 'svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { watchPartyEventSchema, type WatchPartyEvent } from '#lib/watchParty';
	import ui from 'beercss';

	let { onLeave }: { onLeave?: () => void } = $props();

	let room: { id: string; source: EventSource; clientId?: string } | undefined = $state();
	let creating = $state(false);
	let connectionState = $state<'connecting' | 'connected' | 'reconnecting'>('connecting');
	let roomCode = $state('');
	let pending: WatchPartyEvent | undefined = $state();
	let lastSentVideoId: string | undefined;
	let lastRemoteVideoId: string | undefined;
	let baselineVideoId: string | undefined;
	let suppressUntil = 0;

	onMount(() => {
		joinRoomFromUrl();
		ui('#dialog-watch-party');
	});

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
		return `${resolve('/(app)/watch/[slug]', { slug: videoId })}?${currentSearchParams.toString()}`;
	}

	function connect(roomId: string, announceCurrent: boolean) {
		room?.source.close();
		connectionState = 'connecting';
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
				connectionState = 'connected';
				suppressUntil = Date.now() + 4000;
				return;
			}

			handleActionData(payload);
		};

		source.onerror = () => {
			connectionState = 'reconnecting';
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
			goto(`?${currentSearchParams.toString()}`, { shallow: true, state: { replaceState: false } });
		} finally {
			creating = false;
		}
	}

	function joinRoomFromUrl() {
		const givenRoomId = page.url.searchParams.get('room');

		if (!givenRoomId) return;

		connect(givenRoomId, false);
	}

	function joinRoom() {
		const code = roomCode.trim();
		if (!code || room) return;

		let roomId = code;

		try {
			const roomParam = new URL(code).searchParams.get('room');
			if (!roomParam) return;
			roomId = roomParam;
		} catch {
			// not a URL, use the input as the room code
		}

		connect(roomId, false);

		const currentSearchParams = new SvelteURLSearchParams(window.location.search);

		currentSearchParams.set('room', roomId);
		goto(`?${currentSearchParams.toString()}`, { shallow: true, state: { replaceState: false } });
		roomCode = '';
	}

	function shareRoom() {
		if (!room) return;

		const currentSearchParams = new SvelteURLSearchParams(window.location.search);
		currentSearchParams.set('room', room.id);

		shareURL(`${window.location.origin}/?${currentSearchParams.toString()}`);
	}

	function leaveRoom() {
		room?.source.close();
		room = undefined;
		connectionState = 'connecting';
		pending = undefined;
		lastSentVideoId = undefined;
		lastRemoteVideoId = undefined;
		baselineVideoId = undefined;
		suppressUntil = 0;

		const currentSearchParams = new SvelteURLSearchParams(window.location.search);

		currentSearchParams.delete('room');
		goto(`?${currentSearchParams.toString()}`, { shallow: true, state: { replaceState: false } });
		const dialog = document.querySelector<HTMLDialogElement>('#dialog-watch-party');
		if (dialog?.open) {
			ui('#dialog-watch-party');
			requestAnimationFrame(() => onLeave?.());
		} else {
			onLeave?.();
		}
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

<div>
	<dialog id="dialog-watch-party" class="right surface-container watch-party-dialog">
		<article class="watch-party">
			<header class="row">
				<div class="max">
					<h4>{$_('watchParty.header')}</h4>
					<p class="muted">{$_('watchParty.description')}</p>
				</div>
				{#if room}
					<span class="chip" class:primary-container={connectionState === 'connected'}>
						<span class="status-dot" class:online={connectionState === 'connected'}></span>
						{connectionState === 'connected' ? 'Connected' : $_('connecting')}
					</span>
				{/if}
				<button
					class="circle transparent"
					data-ui="#dialog-watch-party"
					aria-label="Close watch party"
				>
					<i>close</i>
				</button>
			</header>

			{#if !room}
				<div class="room-actions">
					<button onclick={createRoom} disabled={creating} class="primary">
						<i>groups</i>
						<span>{creating ? $_('connecting') : $_('watchParty.createRoom')}</span>
					</button>
					<nav class="group join-room">
						<div class="field label surface-container-highest left-round">
							<input
								tabindex="0"
								id="watch-party-join-code"
								bind:value={roomCode}
								type="text"
								placeholder=" "
							/>
							<label tabindex="-1" for="watch-party-join-code">{$_('watchParty.roomID')}</label>
						</div>
						<button
							type="button"
							onclick={joinRoom}
							disabled={!roomCode.trim()}
							class="primary right-round"
							aria-label={$_('watchParty.joinRoom')}
							title={$_('watchParty.joinRoom')}
						>
							<i>login</i>
						</button>
					</nav>
				</div>
			{:else}
				<div class="active-room">
					<div class="field label fill round">
						<input tabindex="0" id="watch-party-room-id" readonly value={room.id} placeholder=" " />
						<label tabindex="-1" for="watch-party-room-id">{$_('watchParty.roomID')}</label>
					</div>
					<button onclick={shareRoom} class="primary share-room-button">
						<i>share</i>
						<span>{$_('watchParty.shareRoom')}</span>
					</button>
					<button onclick={leaveRoom} class="surface-container-highest">
						<i>logout</i>
						<span>{$_('watchParty.leaveRoom')}</span>
					</button>
				</div>
			{/if}
		</article>
	</dialog>
</div>

<style>
	.watch-party-dialog {
		inline-size: min(32rem, calc(100vw - 2rem));
		min-inline-size: 0;
		max-width: 100%;
		padding: 1rem;
	}

	.watch-party {
		margin: 0;
		padding: 0;
		background: transparent;
		box-shadow: none;
	}

	.watch-party header {
		align-items: center;
		margin-bottom: 1rem;
	}

	.watch-party h4,
	.watch-party p {
		margin: 0;
	}

	.watch-party p {
		margin-top: 0.25rem;
		opacity: 0.72;
	}

	.room-actions,
	.active-room {
		display: grid;
		gap: 0.75rem;
	}

	.active-room {
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
	}

	.active-room .field {
		min-width: 0;
	}

	.join-room {
		width: 100%;
	}

	.join-room .field {
		flex: 1 1 auto;
		min-width: 0;
	}

	.join-room button {
		flex: 0 0 3rem;
		width: 3rem;
		height: 3rem;
	}

	.share-room-button {
		height: 3rem;
	}

	.status-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--outline);
	}

	.status-dot.online {
		background: var(--primary);
	}

	@media (max-width: 36rem) {
		.active-room {
			grid-template-columns: minmax(0, 1fr);
		}

		.active-room button {
			box-sizing: border-box;
			width: 100%;
		}
	}
</style>
