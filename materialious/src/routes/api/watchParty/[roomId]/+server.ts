import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { WatchPartyEvent } from '$lib/watchParty';
import {
	broadcastWatchParty,
	createWatchPartyClientId,
	joinWatchParty,
	leaveWatchParty,
	type WatchPartyClient
} from '$lib/server/watchParty';

const SSE_HEADERS = {
	'Content-Type': 'text/event-stream',
	'Cache-Control': 'no-cache, no-transform',
	Connection: 'keep-alive',
	'X-Accel-Buffering': 'no'
};

export const GET: RequestHandler = ({ params }) => {
	const { roomId } = params;
	const clientId = createWatchPartyClientId();
	const encoder = new TextEncoder();

	let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
	let heartbeat: ReturnType<typeof setInterval> | undefined;
	let stopped = false;

	const stop = () => {
		if (stopped) return;
		stopped = true;
		if (heartbeat) clearInterval(heartbeat);
		leaveWatchParty(roomId, clientId);
	};

	const send = (message: WatchPartyEvent) => {
		if (!controller || stopped) return;
		try {
			controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
		} catch {
			stop();
		}
	};

	const client: WatchPartyClient = { id: clientId, send };

	const stream = new ReadableStream<Uint8Array>({
		start(c) {
			controller = c;

			controller.enqueue(
				encoder.encode(`data: ${JSON.stringify({ event: 'hello', clientId })}\n\n`)
			);

			const recent = joinWatchParty(roomId, client);
			for (const message of recent) {
				send(message);
			}

			heartbeat = setInterval(() => {
				try {
					controller?.enqueue(encoder.encode(`: ping\n\n`));
				} catch {
					stop();
				}
			}, 25_000);
		},
		cancel() {
			stop();
		}
	});

	return new Response(stream, { headers: SSE_HEADERS });
};

export const POST: RequestHandler = async ({ params, request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return error(400, 'Invalid JSON body');
	}

	const clientId =
		typeof (body as { clientId?: unknown }).clientId === 'string'
			? (body as { clientId: string }).clientId
			: undefined;

	if (!broadcastWatchParty(params.roomId, clientId, body)) {
		return error(400, 'Invalid watch party event');
	}

	return new Response(undefined, { status: 204 });
};
