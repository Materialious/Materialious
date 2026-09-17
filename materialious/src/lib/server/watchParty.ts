import crypto from 'node:crypto';
import { watchPartyEventSchema, type WatchPartyEvent } from '$lib/watchParty';

export interface WatchPartyClient {
	id: string;
	send: (message: WatchPartyEvent) => void;
}

interface WatchPartyRoom {
	id: string;
	clients: Map<string, WatchPartyClient>;
	recent: WatchPartyEvent[];
	lastActive: number;
}

const rooms = new Map<string, WatchPartyRoom>();

const RECENT_WINDOW_MS = 30_000;
const RECENT_LIMIT = 100;
const EMPTY_ROOM_TTL_MS = 15 * 60_000;

function pruneExpiredRooms(): void {
	const now = Date.now();
	for (const [roomId, room] of rooms) {
		if (room.clients.size === 0 && now - room.lastActive > EMPTY_ROOM_TTL_MS) {
			rooms.delete(roomId);
		}
	}
}

function getOrCreateRoom(roomId: string): WatchPartyRoom {
	pruneExpiredRooms();

	let room = rooms.get(roomId);
	if (!room) {
		room = { id: roomId, clients: new Map(), recent: [], lastActive: Date.now() };
		rooms.set(roomId, room);
	}

	return room;
}

export function createWatchPartyClientId(): string {
	return crypto.randomUUID();
}

export function joinWatchParty(roomId: string, client: WatchPartyClient): WatchPartyEvent[] {
	const room = getOrCreateRoom(roomId);
	room.clients.set(client.id, client);
	room.lastActive = Date.now();

	return room.recent;
}

export function broadcastWatchParty(
	roomId: string,
	fromClientId: string | undefined,
	input: unknown
): boolean {
	const parsed = watchPartyEventSchema.safeParse(input);
	if (!parsed.success) return false;

	const event: WatchPartyEvent = parsed.data;
	const room = getOrCreateRoom(roomId);

	const now = Date.now();
	room.recent = room.recent.filter((e) => now - new Date(e.sent).getTime() < RECENT_WINDOW_MS);
	room.recent.push(event);
	if (room.recent.length > RECENT_LIMIT) {
		room.recent.shift();
	}

	for (const [clientId, client] of room.clients) {
		if (clientId === fromClientId) continue;
		client.send(event);
	}

	room.lastActive = now;

	return true;
}

export function leaveWatchParty(roomId: string, clientId: string): void {
	const room = rooms.get(roomId);
	if (!room) return;

	room.clients.delete(clientId);
	room.lastActive = Date.now();
}
