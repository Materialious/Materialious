<script lang="ts">
	import { goto, pushState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { _ } from '$lib/i18n';
	import { playerState } from '$lib/store';
	import sodium from 'libsodium-wrappers-sumo';
	import { onDestroy, onMount } from 'svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { get } from 'svelte/store';
	import { joinRoom, type ActionReceiver, type DataPayload, type Room } from 'trystero/mqtt';
	import z from 'zod';
	import { addToast } from './Toast.svelte';

	const zWatchPartyEvent = z.object({
		event: z.union([
			z.literal('pause'),
			z.literal('play'),
			z.literal('seek'),
			z.literal('goToVideo')
		]),
		videoId: z.string().regex(/^[a-zA-Z0-9_-]{11}$/),
		sent: z.date(),
		currentTime: z.number().min(0)
	});

	type WatchPartyEvent = z.infer<typeof zWatchPartyEvent>;

	let room: Room | undefined = $state();
	let roomId: string | undefined = $state();

	const appId = 'materialious_';

	type SendEvent = (message: WatchPartyEvent, peerToSendTo?: string) => void;

	// If room not in use message just get sent nowhere.
	let sendEvent: SendEvent = () => {};

	onMount(() => initalRoom());

	onDestroy(() => room?.leave());

	function actionReceiver(receiver: ActionReceiver<DataPayload>) {
		receiver((data) => {
			const dataParsed = zWatchPartyEvent.safeParse(data);
			if (!dataParsed.success) return;

			if (dataParsed.data.event === 'goToVideo') {
				goto(resolve('/watch/[videoId]', { videoId: dataParsed.data.videoId }));
				return;
			}

			const player = $playerState;
			if (!player?.playerElement) return;

			const playerElement = player.playerElement;

			const currentTime = playerElement.currentTime;
			const sentTime = dataParsed.data.sent.getTime();
			const timeDifference = Math.abs(currentTime - sentTime);

			if (timeDifference > 5000) return;

			const currentTimeWithDifference = Math.max(
				0,
				Math.min(dataParsed.data.currentTime + timeDifference, playerElement.duration)
			);

			switch (dataParsed.data.event) {
				case 'play':
					playerElement.play();
					playerElement.currentTime = currentTimeWithDifference;
					break;
				case 'pause':
					playerElement.pause();
					playerElement.currentTime = currentTimeWithDifference;
					break;
				case 'seek':
					playerElement.currentTime = currentTimeWithDifference;
					break;
			}
		});
	}

	function setupRoom(room: Room) {
		const [sendAction, getAction] = room.makeAction('watchParty');

		sendEvent = sendAction as unknown as SendEvent;

		actionReceiver(getAction);
	}

	async function createRoom() {
		await sodium.ready;

		roomId = sodium.to_base64(sodium.randombytes_buf(24));
		room = joinRoom({ appId }, roomId);

		setupRoom(room);

		const currentSearchParams = new SvelteURLSearchParams(window.location.search);

		currentSearchParams.set('room', roomId);

		room.onPeerJoin((peerId) => {
			const player = get(playerState);
			if (!player || !player.data || !player.playerElement) return;

			addToast({
				data: {
					text: $_('watchParty.userJoin')
				}
			});

			sendEvent(
				{
					event: 'goToVideo',
					videoId: player.data.video.videoId,
					sent: new Date(),
					currentTime: player.playerElement.currentTime
				},
				peerId
			);
		});

		room.onPeerLeave(() => {
			addToast({
				data: {
					text: $_('watchParty.userLeft')
				}
			});
		});

		pushState(`?${currentSearchParams.toString()}`, { replaceState: false }); // eslint-disable-line svelte/no-navigation-without-resolve
	}

	function initalRoom() {
		const givenRoomId = page.url.searchParams.get('room');

		if (!givenRoomId) return;

		room = joinRoom({ appId }, givenRoomId);

		setupRoom(room);
	}

	playerState.subscribe((player) => {
		if (!player?.playerElement) return;

		const playerElement = player.playerElement;

		function sendPlayerEvent(event: 'play' | 'pause' | 'seek') {
			if (!room || !player) return;

			sendEvent({
				event,
				videoId: player.data.video.videoId,
				sent: new Date(),
				currentTime: playerElement.currentTime
			});
		}

		let initalPlaying = true;

		playerElement.addEventListener('play', () => sendPlayerEvent('play'));
		playerElement.addEventListener('playing', () => {
			if (!initalPlaying) return;
			initalPlaying = true;

			sendPlayerEvent('play');
		});
		playerElement.addEventListener('seeked', () => sendPlayerEvent('seek'));
		playerElement.addEventListener('pause', () => sendPlayerEvent('pause'));
		playerElement.addEventListener('waiting', () => sendPlayerEvent('pause'));
		playerElement.addEventListener('error', () => sendPlayerEvent('pause'));
	});
</script>

<article>
	<h4>{$_('watchParty.header')}</h4>

	{#if !room}
		<div class="space"></div>

		<button onclick={createRoom} class="surface-container-highest">
			<span>{$_('watchParty.createRoom')}</span>
		</button>
	{:else}
		<div class="space"></div>
		<button
			onclick={() => {
				room?.leave();
				room = undefined;
			}}
			class="surface-container-highest"
		>
			{$_('watchParty.leaveRoom')}
		</button>
	{/if}
</article>
