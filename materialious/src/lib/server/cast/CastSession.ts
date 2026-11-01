import { Constants, YT, type Innertube, type Mixins } from 'youtubei.js';
import {
	SabrStreamingAdapter,
	SabrUmpProcessor,
	type RequestFilter,
	type ResponseFilter,
	type SabrPlayerAdapter
} from 'googlevideo/sabr-streaming-adapter';
import { buildSabrFormat, concatenateChunks, FormatKeyUtils } from 'googlevideo/utils';
import { CompositeBuffer, UmpReader } from 'googlevideo/ump';
import { LiveMetadata } from 'googlevideo/protos';
import type { CacheManager, RequestMetadataManager } from 'googlevideo/utils';
import type { SabrFormat } from 'googlevideo/shared-types';
import { getDownloadSession } from '@materialious/shared/download';
import { getSignedInSession } from './signedIn';
import { parseSegmentIndex, type SegmentIndexEntry } from './sidx';
import { parseWebmIndex } from './webm';
import { buildLiveManifest, type LiveFormat } from './liveManifest';

/**
 * Codec profiles a receiver can be asked to play.
 *
 * Chromecast generations 1-3 decode H.264 and AAC only, so that is the default.
 * Newer Google TV hardware handles VP9 and Opus, which YouTube ships at lower
 * bitrates for the same quality.
 */
export type CastProfile = 'legacy' | 'modern';

export type CastMediaSource = 'vod' | 'live';

/** What a session hands a receiver: a DASH manifest, or YouTube's own HLS. */
export type CastFormat = 'dash' | 'hls';

/** The kind of address YouTube serves HLS playlists from, as opposed to media. */
function isHlsPlaylist(url: URL): boolean {
	return url.hostname === 'manifest.googlevideo.com' || url.pathname.startsWith('/api/manifest/');
}

/** How often an expired HLS playlist may send the session back for a new one. */
const HLS_REFRESH_MIN_MS = 30_000;

/** How many requests to YouTube in a row may fail before a session is given up on. */
const BROKEN_AFTER_FAILURES = 2;

/** One entry of the player response's adaptive formats. */
type RawFormat = NonNullable<YT.VideoInfo['streaming_data']>['adaptive_formats'][number];

type FormatState = {
	format: SabrFormat;
	/** The moov + sidx blob, served verbatim for ranges that land in it. */
	init: Uint8Array;
	segments: SegmentIndexEntry[];
	totalSize: number;
};

const SEGMENT_CACHE_LIMIT = 24;

/** How long the live edge is trusted before being looked up again. */
const LIVE_EDGE_TTL_MS = 10_000;

/**
 * A live segment the server has not produced yet.
 *
 * Distinct from a failure, because a receiver that runs into the live edge
 * should wait and ask again rather than give up on the stream.
 */
export class SegmentNotReadyError extends Error {}

/** The UMP part carrying a live stream's head and seekable window. */
const LIVE_METADATA_PART = 31;

/**
 * Pulls the live metadata out of a raw UMP response.
 *
 * `SabrUmpProcessor` handles the parts a player needs and ignores this one, so
 * the stream is read a second time, cheaply, looking only for that part.
 */
function readLiveMetadata(chunks: Uint8Array[]): LiveMetadata | undefined {
	if (chunks.length === 0) return undefined;

	let live: LiveMetadata | undefined;

	try {
		const reader = new UmpReader(new CompositeBuffer([concatenateChunks(chunks)]));
		reader.read((part) => {
			if (part.type === LIVE_METADATA_PART) {
				live = LiveMetadata.decode(concatenateChunks(part.data.chunks));
			}
		});
	} catch {
		// A stream that will not parse simply has no metadata to offer.
	}

	return live;
}

function decodeXmlEntities(value: string): string {
	return value
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'");
}

/**
 * Drops subtitle tracks from a manifest.
 *
 * Not every player copes with text adaptation sets - ffmpeg's DASH demuxer
 * fails outright on them - so a receiver that trips over subtitles can be given
 * a manifest without any.
 */
function stripTextAdaptationSets(manifest: string): string {
	return manifest.replace(
		/<AdaptationSet(?:(?!<\/AdaptationSet>)[\s\S])*?contentType="text"[\s\S]*?<\/AdaptationSet>/g,
		''
	);
}

/**
 * Player adapter with no player behind it.
 *
 * `SabrStreamingAdapter` normally drives Shaka: it asks the player what time
 * playback is at and rewrites the requests the player makes. Here every request
 * originates from a receiver's HTTP range instead, so the "player time" is
 * whatever segment we are being asked for, and the interceptors are called by
 * hand rather than registered with a networking engine.
 */
class HeadlessPlayerAdapter implements SabrPlayerAdapter {
	public requestMetadataManager?: RequestMetadataManager;
	public cache: CacheManager | null = null;
	public requestInterceptor?: RequestFilter;
	public responseInterceptor?: ResponseFilter;

	/** Presentation time of the segment currently being fetched, in seconds. */
	public playerTime = 0;
	/** The audio/video pair this session serves, so the other can be discarded. */
	public pinned: { audio?: SabrFormat; video?: SabrFormat } = {};

	initialize(
		_player: unknown,
		requestMetadataManager: RequestMetadataManager,
		cache: CacheManager | null
	): void {
		this.requestMetadataManager = requestMetadataManager;
		this.cache = cache;
	}

	getPlayerTime(): number {
		return this.playerTime;
	}

	getPlaybackRate(): number {
		return 1;
	}

	getBandwidthEstimate(): number {
		// The receiver picks the rendition; we only ever fetch what it asks for,
		// so this just has to be high enough not to look like a stalling client.
		return 10_000_000;
	}

	getActiveTrackFormats(activeFormat: SabrFormat): {
		audioFormat?: SabrFormat;
		videoFormat?: SabrFormat;
	} {
		return activeFormat.width
			? { videoFormat: activeFormat, audioFormat: this.pinned.audio }
			: { videoFormat: this.pinned.video, audioFormat: activeFormat };
	}

	registerRequestInterceptor(interceptor: RequestFilter): void {
		this.requestInterceptor = interceptor;
	}

	registerResponseInterceptor(interceptor: ResponseFilter): void {
		this.responseInterceptor = interceptor;
	}

	dispose(): void {
		this.requestInterceptor = undefined;
		this.responseInterceptor = undefined;
	}
}

/**
 * A cast session: everything needed to answer a receiver's requests for one
 * video, held server side because the receiver cannot speak SABR itself.
 */
export class CastSession {
	public lastUsed = Date.now();

	private readonly adapter = new HeadlessPlayerAdapter();
	private sabr!: SabrStreamingAdapter;
	private formats: SabrFormat[] = [];

	private readonly formatStates = new Map<string, FormatState>();
	private readonly pendingStates = new Map<string, Promise<FormatState>>();
	private readonly segmentCache = new Map<string, Uint8Array>();
	private readonly pendingSegments = new Map<string, Promise<Uint8Array>>();
	private liveEdge?: { metadata: LiveMetadata | undefined; at: number };

	/** Player response entries, by format key. */
	private rawFormats = new Map<string, RawFormat>();

	/**
	 * YouTube's HLS playlist for a live stream, where this session serves that
	 * rather than its own DASH, and when it was last fetched.
	 */
	private hlsMaster?: { url: string; at: number };

	/**
	 * What a signed-in session streams with, bound to the video like every
	 * token: the session itself may have been asked for the video without
	 * one, and has none of its own.
	 */
	private streamingPoToken?: string;

	/** Playlists YouTube has since replaced, and what replaced them. */
	private readonly hlsReplaced = new Map<string, string>();

	private constructor(
		public readonly id: string,
		public readonly videoId: string,
		public readonly userId: string | undefined,
		private innertube: Innertube,
		private info: YT.VideoInfo | Mixins.MediaInfo,
		/** Whether the receiver said it can play HLS. */
		public readonly acceptsHls: boolean
	) {}

	static async create(
		id: string,
		videoId: string,
		userId: string | undefined,
		options: { acceptsHls?: boolean; youtubeCookie?: string } = {}
	): Promise<CastSession> {
		let innertube = await getDownloadSession(videoId);
		let info = await innertube.getInfo(videoId);
		let streamingPoToken: string | undefined;

		// Some videos YouTube plays only to somebody signed in - and lately,
		// from this address, nearly all of them ("Sign in to confirm you're not
		// a bot"). Those, and only those, are asked for again as the viewer's
		// own account where the receiver brought its cookies, as the website
		// does: everything else stays anonymous.
		if (info.playability_status?.status === 'LOGIN_REQUIRED' && options.youtubeCookie) {
			try {
				// The anonymous session's token is bound to the same video, and
				// is what the signed-in one streams with: minting another would
				// only cost a second BotGuard run behind every other mint.
				const signedIn = await getSignedInSession(
					options.youtubeCookie,
					videoId,
					innertube.session.po_token
				);
				let signedInSession = signedIn.innertube;
				let signedInInfo = await signedInSession.getInfo(videoId);

				if (!signedInInfo.streaming_data) {
					signedInSession = await signedIn.withPlayerToken();
					signedInInfo = await signedInSession.getInfo(videoId);
				}

				if (signedInInfo.streaming_data) {
					innertube = signedInSession;
					info = signedInInfo;
					streamingPoToken = signedIn.streamingPoToken;
				} else {
					console.warn(
						`cast: ${videoId} was refused to the signed-in account too:`,
						signedInInfo.playability_status?.reason
					);
				}
			} catch (error) {
				console.warn(
					`cast: could not sign in for ${videoId}:`,
					error instanceof Error ? error.message : error
				);
			}
		}

		const session = new CastSession(
			id,
			videoId,
			userId,
			innertube,
			info,
			options.acceptsHls === true
		);
		session.streamingPoToken = streamingPoToken;

		// A live stream is better served as YouTube's own HLS to a receiver that
		// can play it. Over SABR every answer carries an order to wait four or
		// five seconds before the next request, and that wait holds up every
		// request of the session: audio and video take turns, so each got a new
		// segment about every ten seconds, against segments two seconds long.
		// Playback ran dry within a minute and stopped, over and over. HLS has
		// no such wait - it is what YouTube's own apps play live from.
		if (session.acceptsHls && info.basic_info.is_live) {
			try {
				session.hlsMaster = { url: await session.fetchHlsMaster(), at: Date.now() };
			} catch (error) {
				console.warn(
					`cast: no HLS for live ${videoId}, serving DASH instead:`,
					error instanceof Error ? error.message : error
				);
			}
		}

		if (!session.hlsMaster) await session.attachSabr();

		return session;
	}

	/** What this session serves a receiver. */
	get format(): CastFormat {
		return this.hlsMaster ? 'hls' : 'dash';
	}

	/**
	 * The HLS playlist YouTube offers for a live stream.
	 *
	 * Only the Android client is given one; the web and television clients are
	 * refused a live stream outright without a session of their own.
	 */
	private async fetchHlsMaster(): Promise<string> {
		// A signed-in session's own answer may already carry one, and the
		// Android client does not take a browser's cookies.
		const own = this.info.streaming_data?.hls_manifest_url;
		if (own && this.innertube.session.logged_in) return own;

		const android = await this.innertube.getBasicInfo(this.videoId, { client: 'ANDROID' });
		const url = android.streaming_data?.hls_manifest_url ?? own;

		if (!url) {
			throw new Error(android.playability_status?.reason || 'YouTube offered no HLS playlist');
		}

		return url;
	}

	/**
	 * Fetches a playlist, going back for a new master when YouTube says the one
	 * it came from has expired - which its addresses do after a few hours, well
	 * within a stream somebody leaves running.
	 */
	private async fetchHlsPlaylist(target: string, signal: AbortSignal): Promise<string> {
		const first = await fetch(this.hlsReplaced.get(target) ?? target, { signal });
		if (first.ok) return first.text();

		const master = this.hlsMaster;
		const expired = first.status === 403 || first.status === 404 || first.status === 410;

		if (!master || !expired || Date.now() - master.at < HLS_REFRESH_MIN_MS) {
			throw new Error(`YouTube answered ${first.status} for the live playlist`);
		}

		const previous = master.url;
		const renewed = await this.fetchHlsMaster();
		this.hlsMaster = { url: renewed, at: Date.now() };
		this.hlsReplaced.set(previous, renewed);

		let replacement = renewed;

		// A variant is found again in the new master by its itag.
		if (target !== previous) {
			const itag = target.match(/\/itag\/(\d+)\//)?.[1];
			const lines = (await (await fetch(renewed, { signal })).text()).split('\n');
			const found = itag ? lines.find((line) => line.includes(`/itag/${itag}/`)) : undefined;

			if (!found) throw new Error(`The renewed live playlist has no itag ${itag}`);

			replacement = found.trim();
		}

		this.hlsReplaced.set(target, replacement);

		const second = await fetch(replacement, { signal });
		if (!second.ok) throw new Error(`YouTube answered ${second.status} for the live playlist`);

		return second.text();
	}

	/**
	 * Answers a receiver's request for the live stream's HLS: the master
	 * playlist when no target is given, otherwise the playlist or media segment
	 * at that address, which has to be one of YouTube's.
	 *
	 * Playlists are rewritten so every address in them comes back through
	 * `proxyBase`: the receiver talks only to this instance, like the rest of a
	 * cast session, and is never handed an address somewhere else.
	 */
	async getHls(
		target: string | null,
		proxyBase: string,
		maxHeight: number,
		signal: AbortSignal
	): Promise<{ playlist: string } | { media: Response }> {
		this.lastUsed = Date.now();

		const master = this.hlsMaster;
		if (!master) throw new Error('This session does not serve HLS');

		const address = new URL(target ?? master.url);

		if (address.protocol !== 'https:' || !address.hostname.endsWith('.googlevideo.com')) {
			throw new Error('Not a YouTube media address');
		}

		if (!isHlsPlaylist(address)) {
			return { media: await fetch(address, { signal }) };
		}

		const through = (url: string) => `${proxyBase}?u=${encodeURIComponent(url)}`;
		const lines = (await this.fetchHlsPlaylist(address.toString(), signal)).split('\n');

		// The master lists one variant per quality: a description line, then its
		// address. Anything taller than the receiver wants is left out, unless
		// that would leave nothing.
		const tooTall = (line: string) =>
			Number(line.match(/RESOLUTION=\d+x(\d+)/)?.[1] ?? 0) > maxHeight;
		const keepsSomething = lines.some(
			(line) => line.startsWith('#EXT-X-STREAM-INF') && !tooTall(line)
		);

		const out: string[] = [];

		for (let index = 0; index < lines.length; index += 1) {
			const line = lines[index];

			if (keepsSomething && line.startsWith('#EXT-X-STREAM-INF') && tooTall(line)) {
				index += 1;
				continue;
			}

			if (line.startsWith('https://')) {
				out.push(through(line.trim()));
				continue;
			}

			out.push(line.replace(/URI="(https:\/\/[^"]+)"/g, (_match, url) => `URI="${through(url)}"`));
		}

		return { playlist: out.join('\n') };
	}

	get title(): string {
		return this.info.basic_info.title ?? '';
	}

	get author(): string {
		return this.info.basic_info.author ?? '';
	}

	get durationSeconds(): number {
		return this.info.basic_info.duration ?? 0;
	}

	get source(): CastMediaSource {
		return this.info.basic_info.is_live ? 'live' : 'vod';
	}

	private async attachSabr(): Promise<void> {
		const client = this.innertube.session.context.client;
		const streamingData = this.info.streaming_data;

		if (!streamingData) {
			// Said in YouTube's words, which is what anybody looking at a
			// television that will not play wants to know.
			const playability = this.info.playability_status;
			throw new Error(playability?.reason || playability?.status || 'Video has no streaming data');
		}

		const adaptive = streamingData.adaptive_formats ?? [];

		this.formats = adaptive.map(buildSabrFormat);

		// Keyed the same way the gateway addresses formats everywhere else, so
		// the two views of one track cannot drift apart.
		this.rawFormats = new Map();
		this.formats.forEach((format, index) => {
			const key = FormatKeyUtils.fromFormat(format);
			if (key) this.rawFormats.set(key, adaptive[index]);
		});

		this.sabr = new SabrStreamingAdapter({
			playerAdapter: this.adapter,
			clientInfo: {
				osName: client.osName,
				osVersion: client.osVersion,
				clientName: parseInt(
					Constants.CLIENT_NAME_IDS[client.clientName as keyof typeof Constants.CLIENT_NAME_IDS]
				),
				clientVersion: client.clientVersion
			}
		});

		this.sabr.onMintPoToken(
			async () => this.streamingPoToken ?? this.innertube.session.po_token ?? ''
		);
		this.sabr.onReloadPlayerResponse(async (reloadContext) => {
			await this.reloadPlayerResponse(reloadContext);
		});

		this.sabr.setServerAbrFormats(this.formats);
		this.sabr.setUstreamerConfig(
			this.info.player_config?.media_common_config.media_ustreamer_request_config
				?.video_playback_ustreamer_config
		);

		if (!this.innertube.session.player) {
			throw new Error('Player script is required for cast sessions');
		}

		this.sabr.setStreamingURL(
			await this.innertube.session.player.decipher(streamingData.server_abr_streaming_url)
		);

		this.sabr.attach({});

		// Pin the highest H.264 and AAC pair by default; the receiver may switch
		// renditions later, and `getActiveTrackFormats` follows whatever it asks
		// for. This only decides which track is marked as already buffered.
		this.adapter.pinned = {
			audio: this.formats.find((format) => format.mimeType?.includes('mp4a')),
			video: this.formats.find((format) => format.mimeType?.includes('avc1'))
		};
	}

	/** Re-fetches the player response when the SABR server invalidates ours. */
	private async reloadPlayerResponse(reloadContext: unknown): Promise<void> {
		const ask = async (poToken: string | undefined) =>
			new YT.VideoInfo(
				[
					await this.innertube.actions.execute('/player', {
						videoId: this.videoId,
						contentCheckOk: true,
						racyCheckOk: true,
						playbackContext: {
							contentPlaybackContext: {
								signatureTimestamp: this.innertube.session.player?.signature_timestamp
							},
							reloadPlaybackContext: reloadContext
						},
						...(poToken ? { serviceIntegrityDimensions: { poToken } } : {})
					})
				],
				this.innertube.actions,
				(this.info as Mixins.MediaInfo).cpn
			);

		// Asked again the way the session first asked - with its own token if
		// it has one - and if that comes back with nothing to stream, once more
		// the other way, as the website does.
		const own = this.innertube.session.po_token;
		let info = await ask(own);
		if (!info.streaming_data) info = await ask(own ? undefined : this.streamingPoToken);

		// A refusal is not kept over what was working: the old address and
		// configuration at least fail the way they did.
		if (!info.streaming_data || !this.innertube.session.player) {
			console.warn(
				`cast: reload for ${this.videoId} came back with nothing to stream:`,
				info.playability_status?.reason || info.playability_status?.status
			);
			return;
		}

		this.info = info;

		this.sabr.setStreamingURL(
			await this.innertube.session.player.decipher(info.streaming_data.server_abr_streaming_url)
		);
		this.sabr.setUstreamerConfig(
			info.player_config?.media_common_config.media_ustreamer_request_config
				?.video_playback_ustreamer_config
		);
	}

	/**
	 * SABR is one conversation, and the adapter is asked which moment of the
	 * video is wanted through a field rather than through the request - so two
	 * requests in flight at once would be answering each other's question.
	 * Requests started from outside take their turn.
	 */
	private sabrTurn: Promise<unknown> = Promise.resolve();

	private takeTurn<T>(run: () => Promise<T>): Promise<T> {
		const next = this.sabrTurn.then(run, run);
		this.sabrTurn = next.catch(() => undefined);
		return next;
	}

	/**
	 * Runs one request through the SABR interceptor pair and returns the media
	 * bytes. Mirrors what `ShakaPlayerAdapter` does inside the browser.
	 */
	private async sabrRequest(options: {
		url: string;
		headers: Record<string, string>;
		startTime: number | null;
		isInit: boolean;
		playerTime: number;
	}): Promise<Uint8Array> {
		return (await this.sabrRequestWithHeader(options)).data;
	}

	/**
	 * As `sabrRequest`, but keeps the media header.
	 *
	 * Live streams publish no index, so the sequence number the server answers
	 * with is the only way to find out where the live edge currently is.
	 */
	private async sabrRequestWithHeader(options: {
		url: string;
		headers: Record<string, string>;
		startTime: number | null;
		isInit: boolean;
		/** The moment of the video this request is for, in seconds. */
		playerTime: number;
		/** Live probes ask past the edge, where an empty answer is the answer. */
		allowEmpty?: boolean;
	}): Promise<{ data: Uint8Array; sequenceNumber: number | null; live?: LiveMetadata }> {
		try {
			const answer = await this.takeTurn(() => this.performSabrRequest(options));
			this.failuresInARow = 0;
			return answer;
		} catch (error) {
			this.failuresInARow += 1;

			// Said here, because the receiver is only ever told that its range
			// ended early, and that is all anybody would otherwise know.
			console.warn(
				`cast: ${this.videoId} at ${options.playerTime ?? options.startTime}s failed` +
					` (${this.failuresInARow} in a row):`,
				error instanceof Error ? error.message : error
			);

			throw error;
		}
	}

	/** How many requests to YouTube have failed since the last that worked. */
	private failuresInARow = 0;

	/**
	 * Whether this session has stopped working, so it is not handed out again.
	 *
	 * A television whose stream fails asks for the video again, and used to be
	 * given this same session back - the same address, the same state - so a
	 * session that had gone wrong stayed wrong, and the video stopped for good
	 * halfway through. One failure is often just the network; a run of them is
	 * the session.
	 */
	get broken(): boolean {
		return this.failuresInARow >= BROKEN_AFTER_FAILURES;
	}

	/**
	 * The request itself. Called with the session's turn already taken - the
	 * response interceptor can ask for a follow-up request, and that one is
	 * part of the same turn rather than waiting behind it.
	 */
	private async performSabrRequest(options: {
		url: string;
		headers: Record<string, string>;
		startTime: number | null;
		isInit: boolean;
		playerTime?: number;
		allowEmpty?: boolean;
	}): Promise<{ data: Uint8Array; sequenceNumber: number | null; live?: LiveMetadata }> {
		if (options.playerTime !== undefined) this.adapter.playerTime = options.playerTime;

		if (!this.adapter.requestInterceptor || !this.adapter.responseInterceptor) {
			throw new Error('SABR adapter is not attached');
		}

		const request = await this.adapter.requestInterceptor({
			url: options.url,
			method: 'GET',
			headers: { ...options.headers },
			segment: {
				getStartTime: () => options.startTime,
				isInit: () => options.isInit
			},
			body: null
		});

		if (!request) {
			throw new Error('SABR request was dropped by the adapter');
		}

		const response = await fetch(request.url, {
			method: request.method,
			headers: request.headers,
			body: request.body as BodyInit
		});

		const metadata = this.adapter.requestMetadataManager?.getRequestMetadata(request.url);
		let data: Uint8Array | undefined;

		let live: LiveMetadata | undefined;

		if (metadata && response.headers.get('content-type') === 'application/vnd.yt-ump') {
			const processor = new SabrUmpProcessor(metadata, this.adapter.cache ?? undefined);
			const reader = response.body?.getReader();

			if (!reader) throw new Error('SABR response had no body');

			// Kept only for live, where the answer is a part the processor
			// itself does not surface.
			const chunks: Uint8Array[] = [];

			for (;;) {
				const { value, done } = await reader.read();
				if (done) break;
				if (options.allowEmpty) chunks.push(value);
				const result = await processor.processChunk(value);
				if (result?.data) {
					data = result.data;
					await reader.cancel().catch(() => {});
					break;
				}
			}

			if (options.allowEmpty) live = readLiveMetadata(chunks);
		} else {
			data = new Uint8Array(await response.arrayBuffer());
		}

		// Redirects, context updates and player reloads are all signalled in the
		// response rather than by status code, so the adapter has to see it.
		const handled = await this.adapter.responseInterceptor({
			url: request.url,
			method: request.method,
			headers: Object.fromEntries(response.headers),
			data,
			makeRequest: async (url, headers) => ({
				url,
				method: 'POST',
				headers: {},
				data: (
					await this.performSabrRequest({
						url,
						headers: headers ?? {},
						startTime: options.startTime,
						isInit: options.isInit
					})
				).data
			})
		});

		const resolved = (handled?.data as Uint8Array | undefined) ?? data;

		if (!resolved && !options.allowEmpty) {
			throw new Error('SABR request produced no media data');
		}

		const sequence = metadata?.streamInfo?.mediaHeader?.sequenceNumber;

		return {
			data: resolved ?? new Uint8Array(0),
			sequenceNumber: sequence === undefined ? null : Number(sequence),
			live
		};
	}

	private formatUrl(format: SabrFormat): string {
		return `sabr://${format.width ? 'video' : 'audio'}?key=${FormatKeyUtils.fromFormat(format)}`;
	}

	/**
	 * The player response entry a SABR format came from.
	 *
	 * Matched on the format key rather than the itag, because a video with
	 * dubbed audio ships the same itag once per language - twenty three times,
	 * on a video this was found on - and they differ in exactly the fields this
	 * is asked for: how long the format is, and where its index sits. Matching
	 * on itag alone hands every track the first one's numbers, and the gateway
	 * then promises bytes it cannot produce.
	 */
	private rawFormat(format: SabrFormat) {
		const key = FormatKeyUtils.fromFormat(format);
		if (!key) return undefined;

		return this.rawFormats.get(key);
	}

	/** Fetches (once) the init blob and segment index for a format. */
	private async getFormatState(key: string): Promise<FormatState> {
		const cached = this.formatStates.get(key);
		if (cached) return cached;

		const pending = this.pendingStates.get(key);
		if (pending) return pending;

		const promise = (async (): Promise<FormatState> => {
			const format = this.formats.find((candidate) => FormatKeyUtils.fromFormat(candidate) === key);
			if (!format) throw new Error(`Unknown format ${key}`);

			const raw = this.rawFormat(format);
			const indexStart = raw?.index_range?.start ?? 0;
			const indexEnd = raw?.index_range?.end;

			if (indexEnd === undefined) {
				throw new Error(`Format ${key} has no index range`);
			}

			const init = await this.sabrRequest({
				url: this.formatUrl(format),
				headers: { Range: `bytes=0-${indexEnd}` },
				startTime: 0,
				isInit: true,
				playerTime: 0
			});

			// The two containers YouTube serves index themselves differently: MP4
			// carries a sidx box, WebM keeps a Cues element with cluster
			// positions instead.
			const isWebm = format.mimeType?.includes('webm') ?? false;
			const declaredLength = Number(raw?.content_length ?? 0);

			const segments = isWebm
				? parseWebmIndex(init, declaredLength)
				: parseSegmentIndex(init, indexStart, indexEnd + 1);

			if (!segments?.length) {
				throw new Error(`Could not read a segment index for format ${key}`);
			}

			const state: FormatState = {
				format,
				init,
				segments,
				totalSize: declaredLength || segments[segments.length - 1].end + 1
			};

			this.formatStates.set(key, state);
			this.pendingStates.delete(key);
			return state;
		})();

		this.pendingStates.set(key, promise);
		promise.catch(() => this.pendingStates.delete(key));
		return promise;
	}

	private async getSegment(key: string, entry: SegmentIndexEntry): Promise<Uint8Array> {
		const cacheKey = `${key}@${entry.start}`;

		const cached = this.segmentCache.get(cacheKey);
		if (cached) return cached;

		const pending = this.pendingSegments.get(cacheKey);
		if (pending) return pending;

		const promise = (async () => {
			const state = await this.getFormatState(key);
			const data = await this.sabrRequest({
				url: this.formatUrl(state.format),
				headers: {},
				startTime: entry.startTime,
				isInit: false,
				playerTime: entry.startTime
			});

			this.segmentCache.set(cacheKey, data);
			while (this.segmentCache.size > SEGMENT_CACHE_LIMIT) {
				const oldest = this.segmentCache.keys().next().value;
				if (oldest === undefined) break;
				this.segmentCache.delete(oldest);
			}

			this.pendingSegments.delete(cacheKey);
			return data;
		})();

		this.pendingSegments.set(cacheKey, promise);
		promise.catch(() => this.pendingSegments.delete(cacheKey));
		return promise;
	}

	/**
	 * Absorbs the backoff YouTube imposes on a session's first SABR request.
	 *
	 * That first request waits several seconds; later ones return in about a
	 * tenth of a second. Spending it here, while the viewer is still watching a
	 * connecting spinner, keeps the receiver from stalling on its own first
	 * fetch. Failure is not fatal - the receiver would simply wait instead.
	 */
	async warmUp(): Promise<void> {
		// Live has no index to parse ahead of time, and asking for one only
		// burns a request that is bound to fail.
		if (this.source === 'live') return;

		const audio = this.formats.find((format) => format.mimeType?.includes('mp4a'));
		if (!audio) return;

		try {
			await this.getFormatState(FormatKeyUtils.fromFormat(audio) ?? '');
		} catch {
			// Continue regardless; the gateway will retry when asked for real.
		}
	}

	/**
	 * Fetches a subtitle track for the receiver.
	 *
	 * YouTube answers a bare timedtext URL with an empty body: the parameters the
	 * browser player adds are what make it return actual cues, so the same ones
	 * are applied here. Only YouTube's own hosts are accepted, so a session id
	 * cannot be turned into a general purpose proxy.
	 */
	async getCaption(target: string): Promise<string> {
		this.lastUsed = Date.now();

		const url = new URL(target);

		// The receiver only ever asks for URLs this session put in the manifest,
		// and those are all timedtext tracks. Anything else is someone else's
		// idea: the request below carries this session's PO token, so a wider
		// target would make the gateway a signed fetcher for whoever asked.
		if (url.protocol !== 'https:') {
			throw new Error('Caption url is not whitelisted');
		}

		if (url.host !== 'www.youtube.com' && url.host !== 'youtube.com') {
			throw new Error('Caption url is not whitelisted');
		}

		if (url.pathname !== '/api/timedtext') {
			throw new Error('Caption url is not whitelisted');
		}

		url.searchParams.set('fmt', 'vtt');
		url.searchParams.set('potc', '1');
		url.searchParams.set('c', this.innertube.session.context.client.clientName);
		const pot = this.streamingPoToken ?? this.innertube.session.po_token;
		if (pot) url.searchParams.set('pot', pot);
		url.searchParams.delete('xosf');

		// A redirect would take the token somewhere that was never checked, so
		// they are read as failures rather than followed.
		const response = await fetch(url, {
			signal: AbortSignal.timeout(10000),
			redirect: 'manual'
		});

		if (!response.ok) {
			throw new Error(`Captions unavailable (${response.status})`);
		}

		return await response.text();
	}

	/**
	 * How long each live segment runs, which is what the manifest's segment
	 * numbering is built on.
	 */
	get targetDurationSeconds(): number {
		const withTarget = (this.info.streaming_data?.adaptive_formats ?? []).find(
			(format) => (format as { target_duration_dec?: number }).target_duration_dec
		) as { target_duration_dec?: number } | undefined;

		return withTarget?.target_duration_dec ?? 5;
	}

	/**
	 * Finds the segment at the live edge.
	 *
	 * There is no index to read it from, so the server is asked for a time far
	 * beyond the present: it answers with the newest segment it has, and the
	 * sequence number on that answer is the edge. Cached briefly, because every
	 * manifest refresh would otherwise repeat it.
	 */
	/**
	 * Where the stream currently is, as YouTube reports it.
	 *
	 * Asking for media past the live edge returns no media at all, but it does
	 * return the live metadata part, which carries the head and the seekable
	 * window. That makes it the cheapest possible probe: one request, no bytes.
	 */
	private async getLiveMetadata(): Promise<LiveMetadata | undefined> {
		const now = Date.now();
		if (this.liveEdge && now - this.liveEdge.at < LIVE_EDGE_TTL_MS) {
			return this.liveEdge.metadata;
		}

		const format =
			this.formats.find((candidate) => candidate.mimeType?.includes('mp4a')) ?? this.formats[0];

		if (!format) return undefined;

		const pastTheEdge = 10_000_000;
		const { live } = await this.sabrRequestWithHeader({
			url: this.formatUrl(format),
			headers: {},
			startTime: pastTheEdge,
			isInit: false,
			playerTime: pastTheEdge,
			allowEmpty: true
		});

		this.liveEdge = { metadata: live, at: now };

		return live;
	}

	/**
	 * The window a viewer may move around in, in segments.
	 *
	 * Segments are numbered by presentation time rather than by YouTube's own
	 * sequence numbers: those two drift apart, because a segment is only
	 * approximately its target duration, and the gateway addresses media by
	 * time. Numbering by time keeps the manifest and the fetches consistent
	 * with each other.
	 */
	private async getLiveWindow(): Promise<{ edge: number; first: number }> {
		const target = this.targetDurationSeconds;
		const live = await this.getLiveMetadata();

		if (!live) return { edge: 0, first: 0 };

		const headSeconds = Number(live.headTimeMs ?? 0) / 1000;
		const scale = live.minSeekableTimescale || 1000;
		const firstSeconds = Number(live.minSeekableTimeTicks ?? 0) / scale;

		return {
			edge: Math.max(0, Math.floor(headSeconds / target)),
			first: Math.max(0, Math.floor(firstSeconds / target))
		};
	}

	/** The manifest for a live stream, which cannot be indexed like a recording. */
	async getLiveManifest(baseUrl: string, profile: CastProfile, maxHeight: number): Promise<string> {
		this.lastUsed = Date.now();

		const raw = this.info.streaming_data?.adaptive_formats ?? [];

		const formats: LiveFormat[] = raw.map((format) => {
			const mime = format.mime_type ?? '';
			const codecs = mime.match(/codecs="([^"]+)"/)?.[1] ?? '';

			return {
				itag: format.itag,
				key: FormatKeyUtils.fromFormat(buildSabrFormat(format)) ?? String(format.itag),
				mimeType: mime.split(';')[0],
				codecs,
				bitrate: format.bitrate ?? 0,
				width: format.width ?? undefined,
				height: format.height ?? undefined,
				fps: format.fps ?? undefined,
				audioSampleRate: format.audio_sample_rate ?? undefined,
				audioChannels: format.audio_channels ?? undefined,
				language: format.language ?? undefined
			};
		});

		const window = await this.getLiveWindow();

		return buildLiveManifest({
			baseUrl,
			formats,
			targetDurationSeconds: this.targetDurationSeconds,
			edgeSegment: window.edge,
			firstSegment: window.first,
			profile,
			maxHeight
		});
	}

	/**
	 * One live segment, addressed by number rather than by byte range.
	 *
	 * Segment numbers map straight onto presentation time, which is how the
	 * server addresses live media in the first place.
	 */
	async getLiveSegment(key: string, number: number): Promise<Uint8Array> {
		this.lastUsed = Date.now();

		const format = this.formats.find((candidate) => FormatKeyUtils.fromFormat(candidate) === key);
		if (!format) throw new Error(`Unknown format ${key}`);

		const startTime = number * this.targetDurationSeconds;
		const { data } = await this.sabrRequestWithHeader({
			url: this.formatUrl(format),
			headers: {},
			startTime,
			isInit: false,
			playerTime: startTime,
			allowEmpty: true
		});

		// Past the live edge the server answers with metadata and no media.
		if (data.length === 0) {
			throw new SegmentNotReadyError(`Segment ${number} is not available yet`);
		}

		return data;
	}

	/**
	 * The container a format is delivered in.
	 *
	 * Unlike `getFormatMimeType` this reads the format itself rather than a
	 * parsed index, because live formats never have one.
	 */
	mimeTypeForKey(key: string): string {
		const format = this.formats.find((candidate) => FormatKeyUtils.fromFormat(candidate) === key);
		return format?.mimeType?.split(';')[0] ?? 'video/mp4';
	}

	/** Total byte length a receiver should believe a format has. */
	async getFormatSize(key: string): Promise<number> {
		return (await this.getFormatState(key)).totalSize;
	}

	async getFormatMimeType(key: string): Promise<string> {
		const state = await this.getFormatState(key);
		return state.format.mimeType?.split(';')[0] ?? 'video/mp4';
	}

	/**
	 * Yields the bytes covering `[start, end]` of a format's virtual file,
	 * fetching only the segments the range actually touches.
	 */
	async *readRange(
		key: string,
		start: number,
		end: number,
		isAborted: () => boolean = () => false
	): AsyncGenerator<Uint8Array> {
		this.lastUsed = Date.now();
		const state = await this.getFormatState(key);

		const pieces: { start: number; end: number; get: () => Promise<Uint8Array> }[] = [
			{ start: 0, end: state.init.length - 1, get: async () => state.init },
			...state.segments.map((entry) => ({
				start: entry.start,
				end: entry.end,
				get: () => this.getSegment(key, entry)
			}))
		];

		let cursor = start;

		for (const piece of pieces) {
			if (isAborted()) return;
			if (piece.end < cursor || piece.start > end) continue;

			// The index said this piece covers the cursor, so it has to start at
			// or before it. If it starts after, the index and the stream disagree:
			// a negative offset into the slice below would quietly hand back the
			// tail of the segment as if it were the middle of the file.
			if (piece.start > cursor) {
				throw new Error(
					`Gap in ${key}: byte ${cursor} is not covered, next piece starts at ${piece.start}`
				);
			}

			const data = await piece.get();
			const from = cursor - piece.start;
			const to = Math.min(data.length - 1, end - piece.start);

			// A segment shorter than the index promised. Skipping it would stall
			// the cursor here and repeat the same read for every piece after it.
			if (to < from) {
				throw new Error(
					`Short segment in ${key} at byte ${piece.start}: got ${data.length} bytes, expected ${piece.end - piece.start + 1}`
				);
			}

			yield data.slice(from, to + 1);

			cursor = piece.start + to + 1;
			if (cursor > end) return;
		}
	}

	/**
	 * Builds the manifest handed to the receiver: the same DASH presentation the
	 * browser player uses, with the `sabr://` URLs pointed back at this gateway.
	 */
	async getManifest(
		baseUrl: string,
		profile: CastProfile,
		maxHeight: number,
		captions = true
	): Promise<string> {
		this.lastUsed = Date.now();

		const manifest = await this.info.toDash({
			format_filter: (format) => {
				const mimeType = format.mime_type ?? '';
				const height = format.height ?? 0;

				if (height > maxHeight) return true;

				if (profile === 'legacy') {
					// Everything a first generation Chromecast can decode, and
					// nothing it cannot.
					return !(mimeType.includes('avc1') || mimeType.includes('mp4a'));
				}

				return mimeType.includes('av01');
			},
			manifest_options: {
				is_sabr: true,
				include_thumbnails: false,
				...(captions ? { captions_format: 'vtt' as const } : {})
			}
		});

		// `url_transformer` is ignored while `is_sabr` is set, so the emitted
		// sabr:// URLs are rewritten here. A path segment keeps the XML free of
		// the ampersands a query string would need escaped.
		const rewritten = manifest
			.replace(
				/sabr:\/\/(?:video|audio)\?key=([^<"]*)/g,
				(_match, key: string) => `${baseUrl}/media/${encodeURIComponent(key)}`
			)
			.replace(
				/<BaseURL>(https:\/\/[^<]*timedtext[^<]*)<\/BaseURL>/g,
				(_match, url: string) =>
					// The URL is XML encoded in the manifest, so its entities have to
					// be resolved before it is re-encoded as a query parameter -
					// otherwise the gateway would fetch a literal "&amp;" separator
					// and YouTube would ignore every parameter after the first.
					`<BaseURL>${baseUrl}/caption?url=${encodeURIComponent(decodeXmlEntities(url))}</BaseURL>`
			);

		return captions ? rewritten : stripTextAdaptationSets(rewritten);
	}

	dispose(): void {
		this.sabr?.dispose();
		this.adapter.dispose();
		this.formatStates.clear();
		this.segmentCache.clear();
	}
}
