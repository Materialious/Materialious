import { YT, YTNodes, type Helpers, type Innertube } from 'youtubei.js';
import type {
	BrowseChannel,
	BrowseCollaborator,
	BrowseComment,
	BrowsePlaylist,
	BrowseResults,
	BrowseVideo,
	ChannelPage,
	FeedKind,
	FeedPage,
	PlaylistPage,
	VideoPage
} from './types';

// Re-exported so callers can take the shapes and the code that fills them
// from one place.
export type * from './types';
export { BROWSE_CONTRACT_VERSION } from './types';
import { randomUUID } from 'node:crypto';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { env } from '$env/dynamic/private';
import { getBrowseSession } from './session';
import { publishedDates } from './publishedDates';
import { shortsThumbnailUrl, thumbnailUrlForVideoId } from '$lib/api/thumbnails';

function secondsFromLabel(label: string | undefined): number {
	if (!label) return 0;

	const parts = label.split(':').map((part) => parseInt(part, 10));
	if (parts.some(Number.isNaN)) return 0;

	return parts.reduce((total, part) => total * 60 + part, 0);
}

const AGE_UNITS: Record<string, number> = {
	second: 1,
	minute: 60,
	hour: 3600,
	day: 86_400,
	week: 604_800,
	month: 2_629_800,
	year: 31_557_600
};

/**
 * Every way YouTube has been seen to spell a unit, longest first.
 *
 * Months come before minutes, so that the "mo" in "7mo ago" is not read as an
 * "m" with something left over.
 */
const AGE_UNIT_SPELLINGS: [RegExp, keyof typeof AGE_UNITS][] = [
	[/^(seconds?|secs?|s)$/i, 'second'],
	[/^(months?|mos?)$/i, 'month'],
	[/^(minutes?|mins?|m)$/i, 'minute'],
	[/^(hours?|hrs?|h)$/i, 'hour'],
	[/^(days?|d)$/i, 'day'],
	[/^(weeks?|wks?|w)$/i, 'week'],
	[/^(years?|yrs?|y)$/i, 'year']
];

const AGE = /(\d+)\s*([a-z]+)\s+ago/i;

/** How a listing names the channels a video was made with, after the first. */
const COLLABORATORS = /^and\s+\S/;

/**
 * Turns YouTube's "3 days ago", or the "3d ago" it has since moved to, into an
 * age in seconds.
 *
 * The short form arrived without notice and none of it was read, so every
 * video lost its age at once and a feed of a hundred and sixty channels came
 * out in whatever order the channels answered in. Both spellings are read now.
 *
 * Anything it cannot read - a scheduled premiere, a live badge, a language this
 * instance does not run in - comes back null, and sorts to the end rather than
 * pretending to be new.
 */
export function secondsSincePublished(text: string | undefined): number | null {
	if (!text) return null;

	const match = text.match(AGE);
	if (!match) return null;

	const unit = AGE_UNIT_SPELLINGS.find(([spelling]) => spelling.test(match[2]))?.[1];
	if (!unit) return null;

	return Number(match[1]) * AGE_UNITS[unit];
}

function bestThumbnail(thumbnails: { url: string; width?: number }[] | undefined): string | null {
	if (!thumbnails?.length) return null;

	const best = [...thumbnails].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
	if (!best?.url) return null;

	return best.url.startsWith('//') ? `https:${best.url}` : best.url;
}

/**
 * Flattens one item of a YouTube feed.
 *
 * YouTube returns the same video as several different node types depending on
 * the surface it came from, and has been migrating surfaces to `LockupView`, so
 * each shape it actually sends has to be handled rather than assuming one.
 */
export function toBrowseVideo(item: Helpers.YTNode): BrowseVideo | null {
	if (item.is(YTNodes.Video, YTNodes.GridVideo, YTNodes.CompactVideo)) {
		// These three carry the same fields in practice but do not share them in
		// the type union, so they are read through one shape rather than
		// duplicating the mapping three times.
		const video = item as unknown as {
			video_id: string;
			title?: { toString(): string };
			author?: { name?: string; id?: string };
			length_text?: { text?: string };
			published?: { toString(): string };
			view_count?: { toString(): string };
			thumbnails?: { url: string; width?: number }[];
			is_live?: boolean;
		};

		return {
			videoId: video.video_id,
			title: video.title?.toString() ?? '',
			author: video.author?.name ?? '',
			authorId: video.author?.id ?? '',
			lengthSeconds: secondsFromLabel(video.length_text?.text),
			publishedText: video.published?.toString() ?? '',
			publishedSecondsAgo: secondsSincePublished(video.published?.toString()),
			publishedAt: null,
			viewCountText: video.view_count?.toString() ?? '',
			thumbnail: bestThumbnail(video.thumbnails) || thumbnailUrlForVideoId(video.video_id) || null,
			liveNow: video.is_live === true,
			type: video.is_live === true ? 'stream' : 'video',
			collaboration: false
		};
	}

	if (item.is(YTNodes.LockupView)) {
		if (item.content_type !== 'VIDEO' || !item.content_id) return null;

		const metadata = item.metadata;
		const rows = metadata?.metadata?.metadata_rows ?? [];

		// A lockup carries its duration, and says whether it is live, in the
		// badges on its thumbnail rather than in fields of its own.
		let lengthSeconds = 0;
		let live = false;

		if (item.content_image?.is(YTNodes.ThumbnailView)) {
			for (const overlay of item.content_image.overlays ?? []) {
				let badges: { text: string; badge_style: string }[] = [];

				if (overlay.is(YTNodes.ThumbnailBottomOverlayView)) badges = overlay.badges ?? [];
				else if (overlay.is(YTNodes.ThumbnailOverlayBadgeView)) badges = overlay.badges ?? [];

				for (const badge of badges) {
					if (badge.badge_style?.includes('LIVE')) {
						live = true;
						continue;
					}

					const seconds = secondsFromLabel(badge.text);
					if (seconds > 0) lengthSeconds = seconds;
				}
			}
		}

		// The rows mean different things depending on where the lockup came
		// from: a search result names its channel first, while a channel's own
		// feed omits it because the channel is implied. Presence of a channel
		// link is what distinguishes them.
		const authorId =
			metadata?.image?.renderer_context?.command_context?.on_tap?.payload?.browseId ?? '';

		const lockupImage = item.content_image?.is(YTNodes.ThumbnailView)
			? item.content_image.image
			: undefined;
		const statsRow = authorId ? rows[1] : rows[0];

		// Which row and slot the age sits in moves around - a video made with
		// another channel names that channel where the age would have been - so
		// it is looked for rather than assumed. Where nothing reads as an age,
		// the usual slot is still shown as it was.
		const parts = rows
			.flatMap((row) => row.metadata_parts ?? [])
			.map((part) => part.text?.text ?? '');
		const ageIndex = parts.findIndex((text) => secondsSincePublished(text) !== null);
		const agePart = ageIndex === -1 ? statsRow?.metadata_parts?.[1]?.text?.text : parts[ageIndex];

		// A video made with other channels names them after its own - "and
		// Nicole & Ben's Worx Maker Vlogs", or "and 2 more" - in the slot
		// beside the first. Every listing does this, including a channel's own,
		// which otherwise names nobody because the channel is implied.
		const others = parts.find((text) => COLLABORATORS.test(text));
		const author = others
			? `${parts[0]} ${others}`
			: authorId
				? (rows[0]?.metadata_parts?.[0]?.text?.text ?? '')
				: '';

		// The view count sits just before the age wherever the age is, which is
		// also the one slot the names above never take.
		const viewCountText =
			ageIndex > 0 && parts[ageIndex - 1] !== others
				? parts[ageIndex - 1]
				: (statsRow?.metadata_parts?.[0]?.text?.text ?? '');

		return {
			videoId: item.content_id,
			title: metadata?.title?.toString() ?? '',
			author,
			authorId,
			lengthSeconds,
			publishedText: agePart ?? '',
			publishedSecondsAgo: secondsSincePublished(agePart),
			publishedAt: null,
			viewCountText,
			thumbnail: bestThumbnail(lockupImage) || thumbnailUrlForVideoId(item.content_id) || null,
			liveNow: live,
			type: live ? 'stream' : 'video',
			collaboration: others !== undefined
		};
	}

	// Shorts come as their own lockup, which carries almost nothing: no
	// duration, no date, and its two lines of text rather than named fields.
	if (item.is(YTNodes.ShortsLockupView)) {
		const videoId =
			(item.on_tap_endpoint?.payload as { videoId?: string } | undefined)?.videoId ??
			item.entity_id;

		if (!videoId) return null;

		return {
			videoId,
			title: item.overlay_metadata?.primary_text?.toString() ?? '',
			author: '',
			authorId: '',
			lengthSeconds: 0,
			publishedText: '',
			publishedSecondsAgo: null,
			publishedAt: null,
			viewCountText: item.overlay_metadata?.secondary_text?.toString() ?? '',
			thumbnail: bestThumbnail(item.thumbnail) || shortsThumbnailUrl(videoId) || null,
			liveNow: false,
			type: 'shortVideo',
			collaboration: false
		};
	}

	return null;
}

function toBrowseChannel(item: Helpers.YTNode): BrowseChannel | null {
	if (item.is(YTNodes.Channel)) {
		// YouTube moved the handle into subscriber_count and the subscriber
		// count into video_count; the web app reads them the same way.
		return {
			channelId: item.id,
			name: item.author?.name ?? '',
			thumbnail: bestThumbnail(item.author?.thumbnails),
			handle: item.subscriber_count?.toString() ?? '',
			subscriberText: item.video_count?.toString() ?? ''
		};
	}

	// Search returns channels as lockups now, the same migration that moved
	// videos onto them.
	if (item.is(YTNodes.LockupView) && item.content_type === 'CHANNEL' && item.content_id) {
		const rows = item.metadata?.metadata?.metadata_rows ?? [];

		return {
			channelId: item.content_id,
			name: item.metadata?.title?.toString() ?? '',
			thumbnail: bestThumbnail(
				item.content_image?.is(YTNodes.ThumbnailView) ? item.content_image.image : undefined
			),
			handle: rows[0]?.metadata_parts?.[0]?.text?.text ?? '',
			subscriberText: rows[1]?.metadata_parts?.[0]?.text?.text ?? ''
		};
	}

	return null;
}

function toBrowsePlaylist(item: Helpers.YTNode): BrowsePlaylist | null {
	if (!item.is(YTNodes.LockupView) || item.content_type !== 'PLAYLIST' || !item.content_id) {
		return null;
	}

	const rows = item.metadata?.metadata?.metadata_rows ?? [];

	// A playlist's picture is the first video's, held in a collection rather
	// than a plain thumbnail - the rest of the stack is drawn behind it.
	const image = item.content_image as
		| { primary_thumbnail?: { image?: { url: string; width?: number }[] } }
		| undefined;

	const parts = rows
		.flatMap((row) => row.metadata_parts ?? [])
		.map((part) => part.text?.text ?? '')
		.filter((text) => text.length > 0);

	return {
		playlistId: item.content_id,
		title: item.metadata?.title?.toString() ?? '',
		author: parts.find((text) => !/^view full playlist$/i.test(text) && !/video/i.test(text)) ?? '',
		thumbnail: bestThumbnail(image?.primary_thumbnail?.image),
		videoCountText: parts.find((text) => /video/i.test(text)) ?? ''
	};
}

/**
 * Feeds that still have more to give.
 *
 * YouTube pages its results with an opaque continuation, and the library only
 * offers it through the feed object it came from - there is no token to hand a
 * client and take back later. So the feed stays here, under a token of our own,
 * and a client asking for more brings the token back.
 */
const pages = new Map<string, { feed: FeedLike; at: number }>();

/**
 * How long an unused page is kept before it is forgotten.
 *
 * Longer than a channel is cached for, deliberately: a channel's cached copy
 * holds the token for its next page, so a token that expired first would leave
 * a channel that still looks current holding an address that no longer works.
 */
const PAGE_TTL_MS = 45 * 60 * 1000;

/** How many pages are held at once, oldest evicted first. */
const MAX_PAGES = 500;

type FeedLike = {
	videos: Helpers.YTNode[];
	has_continuation: boolean;
	getContinuation(): Promise<FeedLike>;
};

function forgetStalePages(): void {
	const now = Date.now();
	for (const [token, page] of pages) {
		if (now - page.at > PAGE_TTL_MS) pages.delete(token);
	}
}

/** Files a feed away and returns the token that brings back its next page. */
function keepPage(feed: FeedLike | undefined): string | null {
	if (!feed?.has_continuation) return null;

	forgetStalePages();

	// Tokens are handed out on request, so their number is somebody else's
	// decision unless it is made here. The oldest goes; its owner asks again.
	while (pages.size >= MAX_PAGES) {
		const oldest = pages.keys().next().value;
		if (oldest === undefined) break;
		pages.delete(oldest);
	}

	const token = randomUUID();
	pages.set(token, { feed, at: Date.now() });

	return token;
}

/**
 * The next page of whatever produced this token.
 *
 * An expired or unknown token is not an error: the client simply stops asking,
 * which is the same thing that happens at the end of a feed.
 */
export async function continuePage(token: string): Promise<{
	videos: BrowseVideo[];
	continuation: string | null;
}> {
	const page = pages.get(token);
	if (!page) return { videos: [], continuation: null };

	pages.delete(token);

	const next = await page.feed.getContinuation();

	return {
		videos: (next.videos ?? [])
			.map(toBrowseVideo)
			.filter((video): video is BrowseVideo => video !== null),
		continuation: keepPage(next)
	};
}

/**
 * Searches for videos, or for channels.
 *
 * Channels do not appear in an unfiltered search's results at all - they sit
 * inside cards and shelves that vary by query - so asking for them explicitly
 * is the only dependable way to find one.
 */
export async function search(
	query: string,
	type: 'video' | 'channel' = 'video'
): Promise<BrowseResults> {
	const innertube = await getBrowseSession();
	const results =
		type === 'channel'
			? await innertube.search(query, { type: 'channel' })
			: await innertube.search(query);

	const videos: BrowseVideo[] = [];
	const channels: BrowseChannel[] = [];
	const playlists: BrowsePlaylist[] = [];

	for (const item of results.results ?? []) {
		const video = toBrowseVideo(item);
		if (video) {
			videos.push(video);
			continue;
		}

		const playlist = toBrowsePlaylist(item);
		if (playlist) {
			playlists.push(playlist);
			continue;
		}

		const channel = toBrowseChannel(item);
		if (channel) channels.push(channel);
	}

	return { videos, channels, playlists, continuation: keepPage(results as unknown as FeedLike) };
}

/**
 * A channel id as YouTube writes them. Anything else is a name of some kind.
 *
 * Subscriptions can carry an @handle or one of the older `c/` and `user/`
 * forms - imported from elsewhere, or subscribed to before YouTube settled on
 * one shape - and asking the browse endpoint for one of those is simply an
 * error, so those channels were absent from every feed with nothing said.
 */
const CHANNEL_ID = /^UC[\w-]{22}$/;

/** Names already looked up, so the extra request happens once per name. */
const resolvedIds = new Map<string, string>();

/** How many looked-up names are remembered. Anything more is somebody's list. */
const MAX_RESOLVED_IDS = 500;

async function resolveChannelId(innertube: Innertube, id: string): Promise<string> {
	if (CHANNEL_ID.test(id)) return id;

	const known = resolvedIds.get(id);
	if (known) return known;

	const path = id.startsWith('@') || id.includes('/') ? id : `@${id}`;
	const resolved = await innertube.resolveURL(`https://www.youtube.com/${path}`);
	const browseId = (resolved?.payload as { browseId?: string } | undefined)?.browseId;

	if (!browseId) throw new Error(`Could not resolve channel ${id}`);

	while (resolvedIds.size >= MAX_RESOLVED_IDS) {
		const oldest = resolvedIds.keys().next().value;
		if (oldest === undefined) break;
		resolvedIds.delete(oldest);
	}

	resolvedIds.set(id, browseId);

	return browseId;
}

/**
 * What to ask the browse endpoint for to land on each of a channel's tabs.
 *
 * Asking for the channel and then for the tab is two requests, the first of
 * them for a home page nobody reads and three times as slow as the tab - 630ms
 * against 180ms, measured. Every answer carries the channel's header whichever
 * tab it is, so nothing is lost by going straight there. Should YouTube stop
 * honouring one of these, the library notices the tab it landed on is not the
 * one asked for and fetches it the long way, so the cost is a request rather
 * than a wrong answer.
 */
const TAB_PARAMS: Record<FeedKind, string> = {
	videos: 'EgZ2aWRlb3PyBgQKAjoA',
	shorts: 'EgZzaG9ydHPyBgUKA5oBAA==',
	live: 'EgdzdHJlYW1z8gYECgJ6AA==',
	playlists: 'EglwbGF5bGlzdHPyBgQKAkIA'
};

export async function getChannel(
	channelId: string,
	kind: FeedKind = 'videos'
): Promise<ChannelPage> {
	const innertube = await getBrowseSession();
	const id = await resolveChannelId(innertube, channelId);
	const channel = new YT.Channel(
		innertube.actions,
		await innertube.actions.execute('/browse', { browseId: id, params: TAB_PARAMS[kind] })
	);

	let videos: BrowseVideo[] = [];
	let playlists: BrowsePlaylist[] = [];
	let continuation: string | null = null;

	try {
		const tab =
			kind === 'shorts'
				? await channel.getShorts()
				: kind === 'live'
					? await channel.getLiveStreams()
					: kind === 'playlists'
						? await channel.getPlaylists()
						: await channel.getVideos();

		continuation = keepPage(tab as unknown as FeedLike);

		// The playlists tab answers with the same lockups as everything else,
		// so what comes back is sorted by what it turns out to be.
		playlists = ((tab as unknown as { playlists?: Helpers.YTNode[] }).playlists ?? tab.videos ?? [])
			.map(toBrowsePlaylist)
			.filter((playlist): playlist is BrowsePlaylist => playlist !== null)
			.map((playlist) => ({
				...playlist,
				author: playlist.author || (channel.metadata?.title ?? '')
			}));

		videos = (tab.videos ?? [])
			.map(toBrowseVideo)
			.filter((video): video is BrowseVideo => video !== null)
			// A channel's own feed does not repeat whose channel it is, so fill
			// it in from the channel being browsed rather than leaving it blank.
			.map((video) => ({
				...video,
				author: video.author || (channel.metadata?.title ?? ''),
				authorId: video.authorId || channelId
			}));
	} catch {
		// A channel without a videos tab is unusual but not an error worth
		// failing the whole page over.
	}

	// The subscriber count sits in the header's second row of metadata parts,
	// beside the channel's handle and its video count - the same shape a search
	// result's lockup uses, and the same migration that moved everything else.
	const rows =
		(
			channel.header as
				| {
						content?: {
							metadata?: { metadata_rows?: { metadata_parts?: { text?: { text?: string } }[] }[] };
						};
				  }
				| undefined
		)?.content?.metadata?.metadata_rows ?? [];

	const subscriberText =
		rows
			.flatMap((row) => row.metadata_parts ?? [])
			.map((part) => part.text?.text ?? '')
			.find((text) => /subscriber/i.test(text)) ?? '';

	return {
		channelId,
		name: channel.metadata?.title ?? '',
		thumbnail: bestThumbnail(channel.metadata?.avatar as { url: string; width?: number }[]),
		description: channel.metadata?.description ?? '',
		subscriberText,
		videos,
		playlists,
		continuation
	};
}

/**
 * One playlist, with its videos.
 *
 * Playlists are the one list a device can be handed whole: they come back in
 * the order somebody put them in, which is the order they should be played.
 */
export async function getPlaylist(playlistId: string): Promise<PlaylistPage> {
	const innertube = await getBrowseSession();
	const playlist = await innertube.getPlaylist(playlistId);

	const videos = (playlist.videos ?? [])
		.map(toBrowseVideo)
		.filter((video): video is BrowseVideo => video !== null);

	return {
		playlistId,
		title: playlist.info?.title ?? '',
		author: playlist.info?.author?.name ?? '',
		description: playlist.info?.description ?? '',
		videos,
		continuation: keepPage(playlist as unknown as FeedLike)
	};
}

export async function getVideo(videoId: string): Promise<VideoPage> {
	const innertube = await getBrowseSession();
	const info = await innertube.getInfo(videoId);

	const related = (info.watch_next_feed ?? [])
		.map(toBrowseVideo)
		.filter((video): video is BrowseVideo => video !== null);

	return {
		videoId,
		title: info.basic_info.title ?? '',
		author: info.basic_info.author ?? '',
		authorId: info.basic_info.channel_id ?? '',
		description: info.basic_info.short_description ?? '',
		lengthSeconds: info.basic_info.duration ?? 0,
		viewCountText: info.basic_info.view_count?.toString() ?? '',
		publishedText: info.primary_info?.published?.toString() ?? '',
		thumbnail: bestThumbnail(info.basic_info.thumbnail),
		liveNow: info.basic_info.is_live === true,
		related
	};
}

/**
 * The top comments on a video.
 *
 * Replies are counted but not fetched: a television shows a column of comments
 * to read, not a thread to navigate, and each expansion is another round trip.
 */
export async function getComments(videoId: string): Promise<BrowseComment[]> {
	const innertube = await getBrowseSession();
	const comments = await innertube.getComments(videoId, 'TOP_COMMENTS');

	const flattened: BrowseComment[] = [];

	for (const thread of comments.contents ?? []) {
		const comment = thread.comment;
		if (!comment) continue;

		flattened.push({
			commentId: comment.comment_id,
			author: comment.author?.name ?? '',
			authorThumbnail: bestThumbnail(comment.author?.thumbnails),
			content: comment.content?.toString() ?? '',
			publishedText: comment.published_time ?? '',
			likeText: comment.like_count ?? '',
			replyCount: Number(comment.reply_count ?? 0) || 0,
			isPinned: comment.is_pinned === true,
			isOwner: comment.author_is_channel_owner === true
		});
	}

	return flattened;
}

/**
 * The raw answers below are read without youtubei.js, which has no parser for
 * the television layout and turns the collaborator dialog into nothing useful.
 * These are the parts of them that are read; everything else is ignored.
 */
type RawText = { simpleText?: string; runs?: { text?: string }[]; content?: string };
type RawThumbnails = { thumbnails?: { url: string; width?: number }[] };

type RawTile = {
	contentId?: string;
	contentType?: string;
	onSelectCommand?: { watchEndpoint?: { videoId?: string } };
	header?: {
		tileHeaderRenderer?: {
			thumbnail?: RawThumbnails;
			thumbnailOverlays?: {
				thumbnailOverlayTimeStatusRenderer?: { text?: RawText; style?: string };
			}[];
		};
	};
	metadata?: {
		tileMetadataRenderer?: {
			title?: RawText;
			lines?: { lineRenderer?: { items?: { lineItemRenderer?: { text?: RawText } }[] } }[];
		};
	};
};

type RawShelf = {
	headerRenderer?: {
		shelfHeaderRenderer?: { avatarLockup?: { avatarLockupRenderer?: { title?: RawText } } };
	};
	content?: { horizontalListRenderer?: { items?: { tileRenderer?: RawTile }[] } };
};

type RawListItem = {
	listItemViewModel?: {
		title?: {
			content?: string;
			commandRuns?: {
				onTap?: { innertubeCommand?: { browseEndpoint?: { browseId?: string } } };
			}[];
		};
		subtitle?: { content?: string };
		leadingAccessory?: { avatarViewModel?: { image?: { sources?: { url: string }[] } } };
	};
};

type RawOwner = {
	title?: RawText;
	attributedTitle?: { content?: string };
	thumbnail?: RawThumbnails;
	navigationEndpoint?: {
		browseEndpoint?: { browseId?: string };
		showDialogCommand?: {
			panelLoadingStrategy?: {
				inlineContent?: {
					dialogViewModel?: { customContent?: { listViewModel?: { listItems?: RawListItem[] } } };
				};
			};
		};
	};
};

function rawText(text: RawText | undefined): string {
	return (
		text?.simpleText ?? text?.content ?? text?.runs?.map((run) => run.text ?? '').join('') ?? ''
	);
}

/** Every value under a given key, however deep, in the order they appear. */
function findAll<T>(node: unknown, key: string, found: T[] = []): T[] {
	if (!node || typeof node !== 'object') return found;

	for (const [name, value] of Object.entries(node)) {
		if (name === key) found.push(value as T);
		else findAll(value, key, found);
	}

	return found;
}

async function rawRequest(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
	const innertube = await getBrowseSession();
	const response = await innertube.actions.execute(endpoint, { ...body, parse: false });

	return typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
}

/**
 * The titles of the shelves read off a channel's television page, in the
 * language this instance's session asks in. A shelf carries no link or id to
 * know it by, only this.
 */
const VIDEOS_SHELF = 'Videos';
const COLLABORATIONS_SHELF = 'Collaborations';

/** One video tile off the television layout, credited to the channel it is on. */
function fromTile(tile: RawTile | undefined, channelId: string): BrowseVideo | null {
	if (tile?.contentType !== 'TILE_CONTENT_TYPE_VIDEO') return null;

	const videoId = tile.contentId ?? tile.onSelectCommand?.watchEndpoint?.videoId;
	if (!videoId) return null;

	const lines = (tile.metadata?.tileMetadataRenderer?.lines ?? []).map((line) =>
		(line.lineRenderer?.items ?? []).map((item) => rawText(item.lineItemRenderer?.text))
	);

	// The first line names everybody - "Nicole & Ben's Worx Maker Vlogs and
	// Ben's Worx" - and the second is the views and the age, in words.
	const byline = (lines[0] ?? []).join('');
	const stats = lines[1] ?? [];
	const age = stats.find((text) => secondsSincePublished(text) !== null) ?? '';
	const views = stats.find((text) => /views?$/i.test(text)) ?? '';

	const header = tile.header?.tileHeaderRenderer;
	const time = header?.thumbnailOverlays?.find(
		(overlay) => overlay.thumbnailOverlayTimeStatusRenderer
	)?.thumbnailOverlayTimeStatusRenderer;
	const live = time?.style === 'LIVE';

	return {
		videoId,
		title: rawText(tile.metadata?.tileMetadataRenderer?.title),
		author: byline,
		authorId: channelId,
		lengthSeconds: live ? 0 : secondsFromLabel(rawText(time?.text)),
		publishedText: age,
		publishedSecondsAgo: secondsSincePublished(age),
		publishedAt: null,
		// Written "10K views" here, where every other listing says "10K".
		viewCountText: views.replace(/\s*views?$/i, ''),
		thumbnail: bestThumbnail(header?.thumbnail?.thumbnails) || thumbnailUrlForVideoId(videoId),
		liveNow: live,
		type: live ? 'stream' : 'video',
		collaboration: false
	};
}

/** Said when a channel's television page has no shelf of its videos to read. */
class NoVideosShelf extends Error {}

/**
 * A channel's newest videos and its collaborations, from one request.
 *
 * A collaboration is listed only under the channel that uploaded it, so a feed
 * gathered from channels' own videos never sees one that a subscribed channel
 * merely took part in. YouTube's own subscription feed does, from data nobody
 * outside an account can ask for. The one place that says so publicly is a
 * shelf on the television layout of the channel's page, holding the most
 * recent ten - and the same page has a shelf of the channel's own newest two
 * dozen, in the same order as its videos tab, members-only videos left out.
 *
 * So one request does what used to take three: the channel's home page, its
 * videos tab, and this page for the collaborations alone. Fetched separately,
 * the collaborations were also the slowest part, and arrived on screen a
 * minute after everything else.
 *
 * Each collaboration is credited to the channel it was found under, since that
 * is the one somebody is subscribed to; who else made it is a separate
 * question, answered by `getCollaborators` when somebody asks.
 */
async function getChannelFromTelevision(
	channelId: string
): Promise<{ videos: BrowseVideo[]; collaborations: BrowseVideo[] }> {
	const page = await rawRequest('/browse', { browseId: channelId, client: 'TV' });

	const shelves = findAll<RawShelf>(page, 'shelfRenderer');
	const shelf = (title: string) =>
		shelves.find(
			(candidate) =>
				rawText(
					candidate.headerRenderer?.shelfHeaderRenderer?.avatarLockup?.avatarLockupRenderer?.title
				) === title
		);

	const tiles = (found: RawShelf | undefined) =>
		(found?.content?.horizontalListRenderer?.items ?? []).map((item) => item.tileRenderer);

	const own = shelf(VIDEOS_SHELF);
	if (!own) throw new NoVideosShelf(`No ${VIDEOS_SHELF} shelf on ${channelId}'s page`);

	const name = rawText(
		findAll<{ title?: RawText }>(page, 'channelHeaderRenderer')[0]?.title
	).trim();

	const videos = tiles(own)
		.map((tile) => fromTile(tile, channelId))
		.filter((video): video is BrowseVideo => video !== null)
		.map((video) => ({
			...video,
			author: video.author || name,
			// A channel's own upload made with somebody else names them both.
			collaboration: name !== '' && video.author !== name && video.author.startsWith(name)
		}));

	const collaborations = tiles(shelf(COLLABORATIONS_SHELF))
		.map((tile) => fromTile(tile, channelId))
		.filter((video): video is BrowseVideo => video !== null)
		.map((video) => ({ ...video, collaboration: true }));

	return { videos, collaborations };
}

/** Text YouTube wraps in direction marks, which only get in the way here. */
function withoutDirectionMarks(text: string): string {
	return text.replace(/[‎‏⁦-⁩]/g, '');
}

/** How many videos' collaborators are remembered. They do not change. */
const MAX_REMEMBERED_COLLABORATORS = 500;

const collaborators = new Map<string, BrowseCollaborator[]>();

/**
 * The channels that made a video, as the dialog YouTube opens from its byline
 * lists them.
 *
 * A video one channel made alone has no dialog, only a link to that channel,
 * and comes back as a list of one.
 */
export async function getCollaborators(videoId: string): Promise<BrowseCollaborator[]> {
	const remembered = collaborators.get(videoId);
	if (remembered) return remembered;

	const page = await rawRequest('/next', { videoId });
	const owner = findAll<RawOwner>(page, 'videoOwnerRenderer')[0];

	const items =
		owner?.navigationEndpoint?.showDialogCommand?.panelLoadingStrategy?.inlineContent
			?.dialogViewModel?.customContent?.listViewModel?.listItems ?? [];

	let found: BrowseCollaborator[] = items
		.map(({ listItemViewModel: item }) => {
			const sources = item?.leadingAccessory?.avatarViewModel?.image?.sources ?? [];
			const avatar = sources[sources.length - 1]?.url;

			return {
				channelId:
					item?.title?.commandRuns?.[0]?.onTap?.innertubeCommand?.browseEndpoint?.browseId ?? '',
				name: item?.title?.content ?? '',
				subtitle: withoutDirectionMarks(item?.subtitle?.content ?? ''),
				thumbnail: avatar ? (avatar.startsWith('//') ? `https:${avatar}` : avatar) : null
			};
		})
		.filter((collaborator) => /^UC[\w-]{22}$/.test(collaborator.channelId));

	const soleId = owner?.navigationEndpoint?.browseEndpoint?.browseId;

	if (found.length === 0 && soleId) {
		found = [
			{
				channelId: soleId,
				name: rawText(owner?.title) || (owner?.attributedTitle?.content ?? ''),
				subtitle: '',
				thumbnail: bestThumbnail(owner?.thumbnail?.thumbnails)
			}
		];
	}

	// An empty answer is more likely a page that failed to say than a video
	// nobody made, so it is not kept.
	if (found.length) {
		while (collaborators.size >= MAX_REMEMBERED_COLLABORATORS) {
			const oldest = collaborators.keys().next().value;
			if (oldest === undefined) break;
			collaborators.delete(oldest);
		}

		collaborators.set(videoId, found);
	}

	return found;
}

/** How long a channel's videos are served for before being fetched again. */
const FEED_CACHE_MS = 90 * 60 * 1000;

/**
 * How old a channel may get before it is fetched again with nobody waiting.
 *
 * Fetching only when somebody asked meant that whoever opened the feed after
 * half an hour away was shown the old one and then watched it fill in over the
 * next twenty seconds, a few channels at a time. Kept fresh behind the scenes
 * instead, a feed is whole and current the moment it is asked for. Well inside
 * FEED_CACHE_MS, so that nothing anybody asks for has gone stale.
 *
 * An hour and a quarter, not twenty minutes: a hundred and sixty channels every
 * twenty minutes is eight channel pages a minute for as long as anybody is
 * about, and the address was asked to prove it was not a bot again within
 * hours of changing. New uploads still show up when the feed is refreshed.
 */
const KEEP_FRESH_AFTER_MS = 75 * 60 * 1000;

/**
 * How often the stalest channel is fetched, one at a time.
 *
 * Slow on purpose. At one every three seconds, around the clock, this was
 * the bulk of everything the instance asked YouTube - some thirty thousand
 * channel pages a day - and soon after YouTube began asking the address to
 * prove it was not a bot before it would play anything. Whether or not that
 * was the cause, it was the obvious thing to ask less of. A channel that
 * falls behind is still fetched the moment somebody asks.
 */
const KEEP_FRESH_EVERY_MS = 15_000;

/**
 * How long after the last feed anybody asked for channels are still kept
 * fresh. Nobody is looking overnight, and nothing needs fetching for them; an
 * hour after the last look, the next one waits for a fetch instead.
 */
const KEEP_FRESH_WHILE_IN_USE_MS = 60 * 60 * 1000;

/** When anybody last asked for a feed. */
let lastFeedAskedAt = 0;

/**
 * How long after somebody last asked for a channel it is still kept fresh.
 *
 * Long enough to cover a weekend away from the television; anybody back after
 * longer than that waits for a fetch, as everybody used to.
 */
const KEEP_FRESH_FOR_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * The newest copy somebody asking for a refresh may insist on.
 *
 * A refresh fetches every channel in the feed again, so this is what keeps a
 * button pressed over and over from becoming the burst YouTube refuses.
 */
export const MIN_FRESH_WITHIN_MS = 60_000;

/**
 * How many channels are fetched at once.
 *
 * Only a feed with nothing cached pays this: a warm one is served from memory
 * and refreshed behind, and a stale one the same. But an instance that has just
 * restarted has nothing, and a hundred and sixty channels eight at a time is
 * twenty rounds of waiting - ten seconds of blank screen for somebody who just
 * turned the television on.
 */
const FEED_CONCURRENCY = 24;

/** How many rounds deeper one request will go looking for older videos. */
const FEED_MAX_DEEPENING = 3;

/**
 * How long one channel may hold up a feed of a hundred and sixty others.
 *
 * Measured rather than guessed: with nothing cached, the whole request finishes
 * at whatever this is, because some channel always takes that long - widening
 * the fetch from eight at a time to twenty-four changed nothing, since the tail
 * is what everybody waits for. The slow ones keep loading behind the answer and
 * are in the next one; what this decides is how long somebody stares at a blank
 * screen the first time after a restart.
 */
const CHANNEL_TIMEOUT_MS = 4_000;

/** How long a feed waits for channels it has nothing cached for. */
const FEED_FIRST_PAINT_MS = 2_500;

/** How long a channel that failed is left alone before being tried again. */
const FAILED_CHANNEL_RETRY_MS = 2 * 60 * 1000;

/** How long to wait before giving a channel that failed a second chance. */
const CHANNEL_RETRY_MS = 400;

/**
 * How many requests for channels may be with YouTube at once, across
 * everybody's feeds.
 *
 * Each feed's own fetching was already bounded, but a channel refreshed behind
 * an answer, or still loading after its feed gave up waiting, was not - and a
 * feed opened after half an hour away refreshes every channel at once. With a
 * separate request for each channel's collaborations, a hundred and sixty
 * channels once became three hundred and twenty requests inside a second, and
 * YouTube answered a hundred and eleven of them with "too many requests".
 * Collaborations now come in the same request as the channel's own videos.
 */
const CHANNEL_REQUESTS_AT_ONCE = 6;

/**
 * How long requests wait once YouTube has said to slow down, and what counts
 * as saying so: a "too many requests", or a run of failures close together.
 * It has also been seen to answer an address it is tired of with a wave of
 * plain errors instead. Asking again straight away is what keeps it tired, so
 * that kind of request stops for a while.
 */
const COOL_OFF_MS = 30_000;
const FAILURES_BEFORE_COOLING_OFF = 5;
const FAILURE_WINDOW_MS = 10_000;

/**
 * Runs work no more than so many at a time, the rest waiting in turn, and not
 * at all while cooling off.
 *
 * A finished piece hands its place straight to the next in line rather than
 * giving it up, so nothing that arrives in between can take it and run one
 * over the limit.
 */
function limitedTo(atOnce: number, kind: string) {
	let running = 0;
	const waiting: (() => void)[] = [];

	let coolingOffUntil = 0;
	const recentFailures: number[] = [];

	function noteFailedRequest(error: unknown): void {
		// A channel that is gone fails every time, and says nothing about load;
		// nor does one whose page simply has no shelf of videos to read.
		if (isGone(error) || error instanceof NoVideosShelf) return;

		const now = Date.now();

		recentFailures.push(now);
		while (recentFailures.length && recentFailures[0] < now - FAILURE_WINDOW_MS) {
			recentFailures.shift();
		}

		const message = error instanceof Error ? error.message : String(error);
		const tooMany =
			/status code 429/.test(message) || recentFailures.length >= FAILURES_BEFORE_COOLING_OFF;

		if (tooMany && now >= coolingOffUntil) {
			coolingOffUntil = now + COOL_OFF_MS;
			recentFailures.length = 0;
			console.warn(`browse: YouTube is refusing ${kind}; pausing them for ${COOL_OFF_MS / 1000}s`);
		}
	}

	return async function <T>(work: () => Promise<T>): Promise<T> {
		if (running < atOnce) running += 1;
		else await new Promise<void>((resolve) => waiting.push(resolve));

		try {
			while (Date.now() < coolingOffUntil) {
				await new Promise((resolve) => {
					setTimeout(resolve, coolingOffUntil - Date.now()).unref?.();
				});
			}

			return await work();
		} catch (error) {
			noteFailedRequest(error);
			throw error;
		} finally {
			const next = waiting.shift();
			if (next) next();
			else running -= 1;
		}
	};
}

const channelRequest = limitedTo(CHANNEL_REQUESTS_AT_ONCE, 'channels');

/** One channel that could not be fetched, and what it said. */
export type ChannelFailure = {
	channelId: string;
	kind: FeedKind;
	reason: string;
	/** Whether YouTube said the channel is gone, rather than merely failing. */
	permanent: boolean;
	at: string;
};

/** How many recent failures are kept for somebody to look at. */
const MAX_REMEMBERED_FAILURES = 100;

const failures = new Map<string, ChannelFailure>();

function rememberFailure(failure: ChannelFailure): void {
	const key = `${failure.kind}:${failure.channelId}`;

	// One entry per channel: the latest reason is the interesting one, and a
	// channel that fails hourly should not crowd out the rest.
	failures.delete(key);
	failures.set(key, failure);

	while (failures.size > MAX_REMEMBERED_FAILURES) {
		const oldest = failures.keys().next().value;
		if (oldest === undefined) break;
		failures.delete(oldest);
	}
}

/** The channels that have failed since this instance started, newest last. */
export function recentChannelFailures(): ChannelFailure[] {
	return [...failures.values()];
}

/**
 * Whether a channel failed in a way that will still be true next time.
 *
 * YouTube says so in prose rather than in a code, and it has several ways of
 * saying it - the one that turned up in practice was "This channel was removed
 * because it violated our Community Guidelines", which none of the obvious
 * words match. Anything else - a browse endpoint answering 400, a connection
 * that went nowhere - is worth another go, because most of those work on the
 * second attempt.
 */
function isGone(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);

	return /does not exist|terminated|removed|violated|suspended|unavailable|not found/i.test(
		message
	);
}

function pause(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms).unref?.();
	});
}

/**
 * Stands in for a page token where the rest of a channel is best had from its
 * tab: a list read off the television page, or one brought back from disk,
 * whose tokens did not survive the restart. Going deeper reads the tab from the
 * top and carries on from there.
 */
const FROM_THE_TAB = 'from-the-tab';

type Fetched = { videos: BrowseVideo[]; collaborations?: BrowseVideo[]; next: string | null };

/**
 * A channel's newest, from YouTube.
 *
 * The videos tab comes off the television page, collaborations and all. The
 * channel's own tab is the fallback, for a page without a shelf of videos or
 * one that would not load - keeping whatever collaborations were known before,
 * since the tab has none to offer.
 */
async function fetchNewest(
	channelId: string,
	kind: FeedKind,
	remembered: ChannelFeed | undefined
): Promise<Fetched> {
	const fromTheTab = async (): Promise<Fetched> => {
		const channel = await channelRequest(() => getChannel(channelId, kind));

		return {
			videos: channel.videos.map((video) => ({
				...video,
				author: video.author || channel.name,
				authorId: video.authorId || channelId
			})),
			next: channel.continuation
		};
	};

	if (kind === 'videos') {
		try {
			return {
				...(await channelRequest(() => getChannelFromTelevision(channelId))),
				next: FROM_THE_TAB
			};
		} catch (error) {
			if (isGone(error)) throw error;

			return { ...(await fromTheTab()), collaborations: remembered?.collaborations };
		}
	}

	try {
		return await fromTheTab();
	} catch (error) {
		if (isGone(error)) throw error;

		await pause(CHANNEL_RETRY_MS);

		return fromTheTab();
	}
}

type ChannelFeed = {
	videos: BrowseVideo[];
	/**
	 * The videos this channel made with others, uploaded by whoever uploaded
	 * them. Only the videos tab has any.
	 */
	collaborations?: BrowseVideo[];
	/** Token for this channel's next page, or null once it is exhausted. */
	next: string | null;
	at: number;
	/**
	 * When fetching it last failed, so that a channel that keeps failing is
	 * asked about every couple of minutes rather than on every look.
	 */
	failedAt?: number;
	/**
	 * Set when this is the empty answer left behind by a failed fetch.
	 *
	 * A channel with nothing in it and a channel that could not be read are
	 * both an empty list, and only one of them is worth telling anybody about.
	 */
	failed?: true;
	/** Set when YouTube said the channel is gone, so it is not kept fresh. */
	gone?: true;
};

const feedCache = new Map<string, ChannelFeed>();

/** Channels being fetched right now, so two callers wait on one request. */
const inFlight = new Map<string, Promise<ChannelFeed>>();

/** Channels currently being deepened, so a token is spent once. */
const deepening = new Map<string, Promise<boolean>>();

/**
 * When somebody last asked for each channel, so the ones nobody wants any more
 * stop being kept fresh. Least recently asked first.
 */
const wanted = new Map<string, number>();

/** How many videos of one channel are kept, however far anybody scrolls. */
const MAX_CHANNEL_DEPTH = 400;

/** How far into a feed a request may ask, and how much it may take at once. */
const MAX_FEED_OFFSET = 2000;
const MAX_FEED_LIMIT = 120;

/** How many channels are remembered at once, least recently used evicted. */
const MAX_CACHED_CHANNELS = 600;

/** Whether a channel's copy is older than wanted and may be fetched again now. */
function isDue(channel: ChannelFeed, maxAge: number, now = Date.now()): boolean {
	return now - channel.at >= maxAge && now - (channel.failedAt ?? 0) >= FAILED_CHANNEL_RETRY_MS;
}

function keep(key: string, channel: ChannelFeed): void {
	// Keys are channels somebody asked about, so how many there are is their
	// decision unless it is made here. The least recently wanted goes; it costs
	// one request to want it again.
	while (feedCache.size >= MAX_CACHED_CHANNELS && !feedCache.has(key)) {
		const coldest = feedCache.keys().next().value;
		if (coldest === undefined) break;
		feedCache.delete(coldest);
	}

	feedCache.set(key, channel);
	unsaved = true;
}

async function fetchChannel(channelId: string, kind: FeedKind): Promise<ChannelFeed> {
	const key = `${kind}:${channelId}`;

	const existing = inFlight.get(key);
	if (existing) return existing;

	const request = (async () => {
		const remembered = feedCache.get(key);

		try {
			// Both at once: the dates are worth having but not worth waiting for
			// in series behind the page they describe.
			const [fetched, dates] = await Promise.all([
				fetchNewest(channelId, kind, remembered),
				publishedDates(channelId)
			]);

			const dated = (video: BrowseVideo): BrowseVideo => {
				const at = dates.get(video.videoId);
				if (at === undefined) return video;

				return {
					...video,
					publishedAt: at,
					publishedSecondsAgo: Math.max(0, Math.round((Date.now() - at) / 1000))
				};
			};

			const loaded: ChannelFeed = {
				videos: fetched.videos.map(dated),
				collaborations: fetched.collaborations?.map(dated),
				next: fetched.next,
				at: Date.now()
			};

			keep(key, loaded);

			return loaded;
		} catch (error) {
			// One unreachable channel should not empty the whole feed - nor
			// should it be asked again from scratch by every request after
			// this one. A channel that fails keeps what it had, or is
			// remembered as empty, and is tried again in a couple of minutes
			// behind somebody rather than in front of them. Without this a
			// handful of dead channels out of a hundred and sixty means every
			// feed waits the full budget, for ever.
			if (remembered) {
				remembered.failedAt = Date.now();
				return remembered;
			}

			// A channel YouTube says is gone is not coming back, so it is
			// remembered for as long as anything else; one that merely failed
			// is tried again in a couple of minutes.
			const permanent = isGone(error);

			// Said out loud, because a channel that silently contributes
			// nothing to every feed is invisible from the outside: the only
			// symptom is a feed that is quietly short, and the only place the
			// reason exists is here. Kept as well as logged, since reading a
			// container's log is not something everybody running this can do.
			const reason = error instanceof Error ? error.message : String(error);

			console.warn(
				`browse: ${kind} for ${channelId} failed${permanent ? ' for good' : ''}:`,
				reason
			);

			rememberFailure({
				channelId,
				kind,
				reason,
				permanent,
				at: new Date().toISOString()
			});

			const failed: ChannelFeed = {
				videos: [],
				next: null,
				at: permanent ? Date.now() : Date.now() - FEED_CACHE_MS + FAILED_CHANNEL_RETRY_MS,
				failed: true,
				...(permanent ? { gone: true as const } : { failedAt: Date.now() })
			};

			keep(key, failed);

			return failed;
		} finally {
			inFlight.delete(key);
		}
	})();

	inFlight.set(key, request);

	return request;
}

/**
 * Gives up waiting after a while, without giving up on the work.
 *
 * The request carries on and fills the cache, so a channel that answers slowly
 * is merely late to the feed rather than absent from it.
 */
function withDeadline(work: Promise<ChannelFeed>, fallback: ChannelFeed): Promise<ChannelFeed> {
	return Promise.race([
		work,
		new Promise<ChannelFeed>((resolve) => {
			setTimeout(() => resolve(fallback), CHANNEL_TIMEOUT_MS).unref?.();
		})
	]);
}

/**
 * A channel's videos, from memory where possible.
 *
 * A stale copy is served immediately and refreshed behind it: with a hundred
 * and sixty subscriptions, waiting for every channel to answer would be a
 * minute of blank screen for the sake of the handful that changed.
 *
 * @param freshWithin how old a copy may be before it is fetched again - less
 * than usual when somebody has asked for a refresh.
 */
async function loadChannel(
	channelId: string,
	kind: FeedKind,
	freshWithin: number
): Promise<ChannelFeed> {
	const key = `${kind}:${channelId}`;

	wanted.delete(key);
	wanted.set(key, Date.now());

	const cached = feedCache.get(key);

	if (!cached) {
		return withDeadline(fetchChannel(channelId, kind), {
			videos: [],
			next: null,
			at: 0
		});
	}

	if (isDue(cached, freshWithin)) {
		void fetchChannel(channelId, kind);
	}

	// Moved to the end, so the channel nobody has asked about in longest is the
	// one dropped when the cache is full.
	feedCache.delete(key);
	feedCache.set(key, cached);

	return cached;
}

/** Whether a channel is being fetched for the background right now. */
let keepingFresh = false;

/**
 * Fetches the stalest channel anybody still wants, if one is due.
 *
 * One at a time, and only the one: see KEEP_FRESH_EVERY_MS.
 */
function keepOneFresh(): void {
	if (keepingFresh) return;

	const now = Date.now();
	if (now - lastFeedAskedAt > KEEP_FRESH_WHILE_IN_USE_MS) return;

	// Channels nobody has asked about in days are let go of.
	for (const [key, askedAt] of wanted) {
		if (now - askedAt <= KEEP_FRESH_FOR_MS) break;
		wanted.delete(key);
	}

	let stalest: string | undefined;
	let stalestAt = Number.POSITIVE_INFINITY;

	for (const [key, channel] of feedCache) {
		if (channel.gone || inFlight.has(key) || !wanted.has(key)) continue;
		if (!isDue(channel, KEEP_FRESH_AFTER_MS, now)) continue;

		if (channel.at < stalestAt) {
			stalest = key;
			stalestAt = channel.at;
		}
	}

	if (!stalest) return;

	const split = stalest.indexOf(':');

	keepingFresh = true;
	void fetchChannel(stalest.slice(split + 1), stalest.slice(0, split) as FeedKind).finally(() => {
		keepingFresh = false;
	});
}

/** Whether anything has changed since the cache was last written to disk. */
let unsaved = false;

/** How often the cache is written to disk, when it has changed. */
const SAVE_EVERY_MS = 5 * 60 * 1000;

/**
 * Where the cache is kept between restarts: beside the database, which is the
 * one place an instance is certain to have kept. None for a database that is
 * not a file, which means nowhere worth writing to.
 */
function cacheFile(): string | null {
	if (env.FEED_CACHE_FILE) return env.FEED_CACHE_FILE;

	const database = env.DATABASE_CONNECTION_URI?.match(/^sqlite:\/\/(\/.+)$/)?.[1];

	return database ? join(dirname(database), 'feed-cache.json') : null;
}

/** The cache as written to disk. Page tokens live in memory, so not those. */
type SavedFeeds = {
	version: 1;
	channels: [string, Omit<ChannelFeed, 'next'> & { more: boolean }][];
	wanted: [string, number][];
};

function savedFeeds(): string {
	const saved: SavedFeeds = {
		version: 1,
		channels: [...feedCache]
			.filter(([key]) => wanted.has(key))
			.map(([key, channel]) => {
				const { next, ...rest } = channel;
				return [key, { ...rest, more: next !== null }];
			}),
		wanted: [...wanted]
	};

	return JSON.stringify(saved);
}

/**
 * Writes the cache to disk, so that a restart - which is every deploy - starts
 * with a feed rather than with a minute of fetching every channel at once.
 */
async function saveFeeds(): Promise<void> {
	const file = cacheFile();
	if (!file || !unsaved) return;

	unsaved = false;

	try {
		await writeFile(`${file}.tmp`, savedFeeds());
		await rename(`${file}.tmp`, file);
	} catch (error) {
		unsaved = true;
		console.warn('browse: could not save the feed cache:', error);
	}
}

/** The same, at once, for an instance that is about to stop. */
function saveFeedsNow(): void {
	const file = cacheFile();
	if (!file || !unsaved) return;

	try {
		writeFileSync(`${file}.tmp`, savedFeeds());
		renameSync(`${file}.tmp`, file);
		unsaved = false;
	} catch (error) {
		console.warn('browse: could not save the feed cache:', error);
	}
}

function loadSavedFeeds(): void {
	const file = cacheFile();
	if (!file) return;

	let saved: SavedFeeds;
	try {
		saved = JSON.parse(readFileSync(file, 'utf8'));
	} catch {
		// Nothing saved yet, or nothing readable: either way, start empty.
		return;
	}

	if (saved?.version !== 1) return;

	for (const [key, askedAt] of saved.wanted ?? []) wanted.set(key, askedAt);

	for (const [key, channel] of (saved.channels ?? []).slice(-MAX_CACHED_CHANNELS)) {
		const { more, ...rest } = channel;
		if (!feedCache.has(key)) feedCache.set(key, { ...rest, next: more ? FROM_THE_TAB : null });
	}

	console.log(`browse: brought back ${feedCache.size} channels from ${file}`);
}

let keepingFeeds = false;

/**
 * Brings back the cache this instance had before it last stopped, and keeps it
 * fresh and saved from now on. Called as the server starts; safe to call again.
 */
export function keepFeeds(): void {
	if (keepingFeeds) return;
	keepingFeeds = true;

	loadSavedFeeds();

	setInterval(keepOneFresh, KEEP_FRESH_EVERY_MS).unref?.();
	setInterval(() => void saveFeeds(), SAVE_EVERY_MS).unref?.();

	// adapter-node says so before it stops, on the signal a container is
	// stopped with.
	process.once('sveltekit:shutdown', saveFeedsNow);
}

/**
 * Pulls one more page into a channel's list, if it has one.
 *
 * One at a time per channel: a token is spent on use, so two requests deepening
 * the same channel at once would have the loser told the token is unknown - and
 * an unknown token is not the same as a channel with nothing left. Writing that
 * back would mark a channel exhausted for everybody until its cache expires.
 */
async function deepenChannel(key: string, channel: ChannelFeed): Promise<boolean> {
	const token = channel.next;
	if (!token) return false;

	const already = deepening.get(key);
	if (already) return already;

	const split = key.indexOf(':');
	const channelId = key.slice(split + 1);

	const request = (async () => {
		let page: { videos: BrowseVideo[]; continuation: string | null };

		if (token === FROM_THE_TAB) {
			page = await channelRequest(() => getChannel(channelId, key.slice(0, split) as FeedKind));
		} else {
			page = await continuePage(token);
		}

		// Nothing came back and no new token: the page is gone rather than
		// empty, so leave the channel as it was and let its next refresh
		// reissue one.
		if (!page.videos.length && !page.continuation) return false;

		// The tab read from the top repeats what the channel already has.
		const known = new Set(channel.videos.map((video) => video.videoId));
		// And a channel's own pages do not say whose they are.
		const name = channel.videos.find((video) => !video.collaboration)?.author ?? '';
		const added = page.videos
			.filter((video) => !known.has(video.videoId))
			.map((video) => ({
				...video,
				author: video.author || name,
				authorId: video.authorId || channelId
			}));

		channel.videos = [...channel.videos, ...added].slice(0, MAX_CHANNEL_DEPTH);
		channel.next = page.continuation;

		return added.length > 0 || page.continuation !== null;
	})().finally(() => deepening.delete(key));

	deepening.set(key, request);

	return request;
}

/**
 * When a video went up, for ordering; later is newer.
 *
 * An exact time where the channel's feed carried one, and the wording read
 * back against the clock otherwise. The exact one is used as it is rather than
 * being turned into an age: an age is fixed when its channel is fetched, and
 * channels are fetched up to half an hour apart, so ages from two of them are
 * not quite measured against the same moment.
 */
function publishedMs(video: BrowseVideo, now: number): number {
	if (video.publishedAt !== null) return video.publishedAt;
	if (video.publishedSecondsAgo !== null) return now - video.publishedSecondsAgo * 1000;

	return Number.NEGATIVE_INFINITY;
}

/** A video's age restated against the given moment, where that is possible. */
function agedAsOf(video: BrowseVideo, asOf: number): BrowseVideo {
	if (video.publishedAt === null) return video;

	return {
		...video,
		publishedSecondsAgo: Math.max(0, Math.round((asOf - video.publishedAt) / 1000))
	};
}

/** Whether anything is known about when a video went up. */
function isDated(video: BrowseVideo): boolean {
	return video.publishedAt !== null || video.publishedSecondsAgo !== null;
}

/**
 * Live first - it is happening now - then newest to oldest, and by id where
 * even that cannot separate two.
 *
 * The last of those matters more than it looks: where the wording is all there
 * is, every video uploaded on the same day claims the same age, and leaving
 * those in whatever order the channels answered in meant the page boundary
 * fell somewhere different on every request. A video near it appeared and
 * disappeared between one look and the next.
 */
function byRecency(now: number): (a: BrowseVideo, b: BrowseVideo) => number {
	return (a, b) => {
		if (a.liveNow !== b.liveNow) return a.liveNow ? -1 : 1;

		const difference = publishedMs(b, now) - publishedMs(a, now);
		if (difference !== 0) return difference;

		return a.videoId.localeCompare(b.videoId);
	};
}

/**
 * Merges channels into one list, newest first.
 *
 * Shorts carry no date at all, so anything undated cannot be ordered against
 * anything else. Rather than let it fall into channel order - every video of
 * one channel, then every video of the next - undated videos are dealt out one
 * per channel, which is the same shape a dated feed ends up with.
 *
 * A video can arrive more than once: a collaboration is in its uploader's list
 * and in the collaborations of everybody who made it. The first copy is kept,
 * so whatever is passed first wins - the channels' own lists go before their
 * collaborations, since an uploader's copy says more about the video.
 */
function mergeChannels(channels: { videos: BrowseVideo[] }[]): BrowseVideo[] {
	const live: BrowseVideo[] = [];
	const dated: BrowseVideo[] = [];
	const undated: BrowseVideo[][] = [];
	const seen = new Set<string>();

	for (const channel of channels) {
		const rest: BrowseVideo[] = [];

		for (const video of channel.videos) {
			if (seen.has(video.videoId)) continue;
			seen.add(video.videoId);

			// On now, so first - and on its own, because a stream in progress
			// is dated by how many are watching rather than by when it went up,
			// and was dealt in among the undated after every dated video, below
			// streams that ended days ago.
			if (video.liveNow) live.push(video);
			else if (isDated(video)) dated.push(video);
			else rest.push(video);
		}

		if (rest.length) undated.push(rest);
	}

	dated.sort(byRecency(Date.now()));

	const dealt: BrowseVideo[] = [];
	const deepest = Math.max(0, ...undated.map((channel) => channel.length));

	for (let index = 0; index < deepest; index += 1) {
		for (const channel of undated) {
			const video = channel[index];
			if (video) dealt.push(video);
		}
	}

	return [...live, ...dated, ...dealt];
}

/**
 * The newest videos across a set of channels, merged into one list.
 *
 * Subscriptions are encrypted, so the instance cannot know whose feed this is:
 * the client says which channels it wants. Fetching them here rather than on
 * the client turns a dozen sequential round trips over a television's network
 * into one, and lets the results be cached for everyone asking.
 *
 * Scrolling past the end of what has been gathered goes back a page in every
 * channel at once, because a merged feed cannot know which channel the next
 * oldest video belongs to until it has looked.
 */
export async function getFeed(
	channelIds: string[],
	options: { kind?: FeedKind; offset?: number; limit?: number; freshWithin?: number } = {}
): Promise<FeedPage> {
	keepFeeds();
	lastFeedAskedAt = Date.now();

	// An offset is how far somebody has scrolled, and nobody scrolls past what
	// is kept. Left unbounded it is instead an instruction to go as deep as
	// possible in every channel at once - hundreds of fetches for one request,
	// appended permanently to state everyone shares.
	const offset = Math.min(Math.max(0, options.offset ?? 0), MAX_FEED_OFFSET);
	const limit = Math.min(Math.max(1, options.limit ?? 60), MAX_FEED_LIMIT);
	const kind = options.kind ?? 'videos';
	const freshWithin = Math.min(
		Math.max(MIN_FRESH_WITHIN_MS, options.freshWithin ?? FEED_CACHE_MS),
		FEED_CACHE_MS
	);

	const queue = [...channelIds];
	const loaded: { key: string; channel: ChannelFeed }[] = [];

	const workers = Array.from({ length: Math.min(FEED_CONCURRENCY, queue.length) }, async () => {
		for (;;) {
			const channelId = queue.shift();
			if (!channelId) return;

			loaded.push({
				key: `${kind}:${channelId}`,
				channel: await loadChannel(channelId, kind, freshWithin)
			});
		}
	});

	// Cached channels answer at once and the rest are a request each, so a feed
	// with nothing behind it is a hundred and sixty requests deep - eight
	// seconds measured, whether they run eight at a time or twenty-four. Rather
	// than hold the screen blank for all of them, the answer goes out with
	// whatever has arrived; the rest carry on filling the cache and are in the
	// next one, which is a second away rather than eight.
	await Promise.race([
		Promise.all(workers),
		new Promise((resolve) => {
			setTimeout(resolve, FEED_FIRST_PAINT_MS).unref?.();
		})
	]);

	const answered = [...loaded];
	const partial = answered.length < channelIds.length;

	// Channels that could not be read at all - not channels that simply have
	// nothing in this tab, which look identical from the outside and are not
	// worth telling anybody about.
	const unavailable = answered
		.filter((entry) => entry.channel.failed === true)
		.map((entry) => entry.key.slice(entry.key.indexOf(':') + 1));

	// The channels' own lists go before their collaborations, so that where a
	// video is in both - one subscribed channel uploaded it, another took part
	// - the uploader's copy is the one kept.
	const merged = () =>
		mergeChannels([
			...answered.map((entry) => entry.channel),
			...answered.map((entry) => ({ videos: entry.channel.collaborations ?? [] }))
		]);

	let videos = merged();

	// Only go looking for older videos when somebody has scrolled far enough to
	// need them - and never while channels are still arriving, since that is
	// digging deeper into a hole that is still being filled in.
	for (let round = 0; !partial && round < FEED_MAX_DEEPENING; round += 1) {
		if (videos.length >= offset + limit) break;
		if (!answered.some((entry) => entry.channel.next)) break;

		await Promise.all(answered.map((entry) => deepenChannel(entry.key, entry.channel)));

		videos = merged();
	}

	// Ages are worked out when a channel is fetched and a channel is held for
	// a while, so by the time one is handed out it can be minutes behind. Where
	// the exact time is known the age is taken again here, so what a device is
	// told is as of now.
	const asOf = Date.now();

	// A channel served from a copy that is being fetched again counts the same
	// as one that had not answered at all: the screen is told a newer answer is
	// seconds away, rather than being left with the old one until somebody
	// reloads it. Kept fresh in the background, that is rare unless somebody
	// asked for a refresh.
	const refreshing = channelIds.some((channelId) => inFlight.has(`${kind}:${channelId}`));

	return {
		videos: videos.slice(offset, offset + limit).map((video) => agedAsOf(video, asOf)),
		hasMore: videos.length > offset + limit || answered.some((entry) => entry.channel.next),
		// Says this is what had arrived in time, not everything there is: a
		// client that asks again shortly gets the rest.
		partial: partial || refreshing,
		unavailable
	};
}

export { getBrowseSession };
