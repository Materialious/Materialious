import z from 'zod';

export const watchPartyEventSchema = z.object({
	event: z.union([
		z.literal('pause'),
		z.literal('play'),
		z.literal('seek'),
		z.literal('goToVideo')
	]),
	videoId: z.string().regex(/^[a-zA-Z0-9_-]{11}$/),
	sent: z.string().datetime(),
	currentTime: z.number().min(0)
});

export type WatchPartyEvent = z.infer<typeof watchPartyEventSchema>;
