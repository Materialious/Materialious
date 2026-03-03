<script lang="ts">
	import { _ } from '$lib/i18n';
	import { playerState } from '$lib/store';
	import sodium from 'libsodium-wrappers-sumo';
	import { joinRoom, type ActionReceiver, type DataPayload, type Room } from 'trystero';
	import z from 'zod';

	const zWatchPartyEvent = z.object({
		event: z.union([z.literal('pause'), z.literal('play'), z.literal('seek')]),
		videoId: z.regex(/^[a-zA-Z0-9_-]{11}$/),
		sent: z.date(),
		currentTime: z.number()
	});

	type WatchPartyEvent = z.infer<typeof zWatchPartyEvent>;

	let room: Room | undefined = $state();

	const appId = 'materialious_';

	type SendEvent = (message: WatchPartyEvent) => void;

	// If room not in use message just get sent nowhere.
	let sendEvent: SendEvent = (message: WatchPartyEvent) => {};

	function actionReceiver(receiver: ActionReceiver<DataPayload>) {
		receiver((data) => {
			const dataParsed = zWatchPartyEvent.safeParse(data);
			if (!dataParsed.success) return;

			const player = $playerState;
			if (!player?.playerElement) return;

			const playerElement = player.playerElement;

			switch (dataParsed.data.event) {
				case 'play':
					playerElement.play();
					break;
				case 'pause':
					playerElement.pause();
					break;
				case 'seek':
					playerElement.currentTime = dataParsed.data.currentTime;
					break;
			}
		});
	}

	async function createRoom() {
		await sodium.ready;

		const roomId = sodium.to_base64(sodium.randombytes_buf(24));

		room = joinRoom({ appId }, roomId);

		const [sendAction, getAction] = room.makeAction('watchParty');

		sendEvent = sendAction as unknown as SendEvent;

		actionReceiver(getAction);
	}

	playerState.subscribe((player) => {
		if (!player?.playerElement) return;

		const playerElement = player.playerElement;

		playerElement.addEventListener('play', () => {
			if (!room) return;

			sendEvent({
				event: 'play',
				videoId: player.data.video.videoId,
				sent: new Date(),
				currentTime: playerElement.currentTime
			});
		});

		playerElement.addEventListener('playing', () => {
			if (!room) return;

			sendEvent({
				event: 'play',
				videoId: player.data.video.videoId,
				sent: new Date(),
				currentTime: playerElement.currentTime
			});
		});

		playerElement.addEventListener('seeked', () => {
			sendEvent({
				event: 'seek',
				videoId: player.data.video.videoId,
				sent: new Date(),
				currentTime: playerElement.currentTime
			});
		});

		playerElement.addEventListener('pause', () => {
			sendEvent({
				event: 'pause',
				videoId: player.data.video.videoId,
				sent: new Date(),
				currentTime: playerElement.currentTime
			});
		});

		playerElement.addEventListener('waiting', () => {
			sendEvent({
				event: 'pause',
				videoId: player.data.video.videoId,
				sent: new Date(),
				currentTime: playerElement.currentTime
			});
		});

		playerElement.addEventListener('error', () => {
			sendEvent({
				event: 'pause',
				videoId: player.data.video.videoId,
				sent: new Date(),
				currentTime: playerElement.currentTime
			});
		});
	});
</script>

<article>
	<h4>{$_('watchParty.header')}</h4>
	<div class="space"></div>

	{#if !room}
		<button onclick={createRoom} class="surface-container-highest">
			<span>{$_('watchParty.createRoom')}</span>
		</button>
		<button class="surface-container-high">
			<span>{$_('watchParty.joinRoom')}</span>
		</button>
	{/if}
</article>
