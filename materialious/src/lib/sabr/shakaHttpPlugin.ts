import shaka from 'shaka-player/dist/shaka-player.ui';
import type { Misc } from 'youtubei.js/web';
import type { Protos } from 'googlevideo';

import { retrieveCachedSegment } from './cacheHelper';
import { SabrUmpParser } from './sabrUmpParser';
import { CacheManager } from './cacheManager';
import { Capacitor } from '@capacitor/core';
import { androidFetch } from '$lib/android/http/androidRequests';

export interface SabrStreamingContext {
	byteRange?: { start: number; end: number };
	format?: Misc.Format;
	isInit?: boolean;
	isUMP?: boolean;
	isSABR?: boolean;
	playerTimeMs?: number;
	streamInfo?: {
		playbackCookie?: Protos.PlaybackCookie;
		formatInitMetadata?: Protos.FormatInitializationMetadata[];
		streamProtectionStatus?: Protos.StreamProtectionStatus;
		mediaHeader?: Protos.MediaHeader;
		redirect?: Protos.SabrRedirect;
	};
	error?: {
		sabrError?: Protos.SabrError;
	};
}

export class HttpFetchPlugin {
	private static fetch_ = Capacitor.getPlatform() === 'android' ? androidFetch : window.fetch;
	private static AbortController_ = window.AbortController;
	private static Headers_ = window.Headers;
	public static cacheManager = new CacheManager();

	private static asMap<K, V>(object: Record<string, V>): Map<K, V> {
		const map = new Map<K, V>();
		for (const key of Object.keys(object)) {
			map.set(key as K, object[key]);
		}
		return map;
	}

	static parse(
		uri: string,
		request: shaka.extern.Request,
		requestType: shaka.net.NetworkingEngine.RequestType,
		_progressUpdated: shaka.extern.ProgressUpdated,
		headersReceived: shaka.extern.HeadersReceived
	): shaka.extern.IAbortableOperation<shaka.extern.Response> {
		const headers = new HttpFetchPlugin.Headers_();

		HttpFetchPlugin.asMap(request.headers).forEach((value, key) => {
			headers.append(key as string, value as string);
		});

		let sabrStreamingContext: string | null = null;

		// Save the streaming context for later use, then remove it from the headers
		// as it's only used by the player and not the server.
		if (headers.has('X-Streaming-Context')) {
			sabrStreamingContext = headers.get('X-Streaming-Context');
			headers.delete('X-Streaming-Context');
		}

		// Parse uri and remove "___key" query param (same situation as above).
		const url = new URL(uri);
		url.searchParams.delete('___key');
		uri = url.toString();

		const controller = new HttpFetchPlugin.AbortController_();
		const init: RequestInit = {
			body: request.body || undefined,
			headers,
			method: request.method,
			signal: controller.signal,
			credentials: request.allowCrossSiteCredentials ? 'include' : undefined
		};

		const abortStatus = {
			canceled: false,
			timedOut: false
		};

		const pendingRequest = HttpFetchPlugin.request_(
			uri,
			request,
			requestType,
			init,
			controller,
			abortStatus,
			headersReceived,
			sabrStreamingContext
		);

		const op = new shaka.util.AbortableOperation(pendingRequest, () => {
			abortStatus.canceled = true;
			controller.abort();
			return Promise.resolve();
		});

		const timeoutMs = request.retryParameters.timeout;
		if (timeoutMs) {
			// const timer = new shaka.util.Timer(() => {
			// 	abortStatus.timedOut = true;
			// 	controller.abort();
			// });
			// timer.tickAfter(timeoutMs / 1000);
			// op.finally(() => timer.stop());
		}

		return op;
	}

	private static async request_(
		uri: string,
		request: shaka.extern.Request,
		requestType: shaka.net.NetworkingEngine.RequestType,
		init: RequestInit,
		abortController: AbortController,
		abortStatus: { canceled: boolean; timedOut: boolean },
		headersReceived: shaka.extern.HeadersReceived,
		streamingContext: string | null
	): Promise<shaka.extern.Response> {
		const fetch = HttpFetchPlugin.fetch_;
		const decodedStreamingContext = streamingContext
			? (JSON.parse(atob(streamingContext)) as SabrStreamingContext)
			: undefined;

		let response: Response;
		let arrayBuffer: ArrayBuffer | undefined;

		try {
			// Try to use cached segment first
			if (decodedStreamingContext && decodedStreamingContext.format) {
				const cachedResponse = retrieveCachedSegment(
					decodedStreamingContext,
					request,
					requestType,
					uri
				);
				if (cachedResponse) {
					return cachedResponse;
				}
			}

			response = await fetch(uri, init);
			headersReceived(HttpFetchPlugin.headersToGenericObject_(response.headers));

			// Handle UMP responses
			if (
				init.method !== 'HEAD' &&
				decodedStreamingContext &&
				response.headers.get('content-type') === 'application/vnd.yt-ump'
			) {
				const parser = new SabrUmpParser(
					response,
					decodedStreamingContext,
					uri,
					request,
					requestType,
					abortController
				);
				return parser.parse();
			}

			arrayBuffer = await response.arrayBuffer();
		} catch (error) {
			if (abortStatus.canceled) {
				throw new shaka.util.Error(
					shaka.util.Error.Severity.RECOVERABLE,
					shaka.util.Error.Category.NETWORK,
					shaka.util.Error.Code.OPERATION_ABORTED,
					uri,
					requestType
				);
			} else if (abortStatus.timedOut) {
				throw new shaka.util.Error(
					shaka.util.Error.Severity.RECOVERABLE,
					shaka.util.Error.Category.NETWORK,
					shaka.util.Error.Code.TIMEOUT,
					uri,
					requestType
				);
			}
			throw new shaka.util.Error(
				shaka.util.Error.Severity.RECOVERABLE,
				shaka.util.Error.Category.NETWORK,
				shaka.util.Error.Code.HTTP_ERROR,
				uri,
				error,
				requestType
			);
		}

		const headers = HttpFetchPlugin.headersToGenericObject_(response.headers);
		if (streamingContext) {
			headers['X-Streaming-Context'] = streamingContext;
		}

		return HttpFetchPlugin.makeResponse(
			headers,
			arrayBuffer!,
			response.status,
			uri,
			response.url,
			request,
			requestType
		);
	}

	public static makeResponse(
		headers: Record<string, string>,
		data: BufferSource,
		status: number,
		uri: string,
		responseURL: string,
		request: shaka.extern.Request,
		requestType: shaka.net.NetworkingEngine.RequestType
	): shaka.extern.Response & { originalRequest: shaka.extern.Request } {
		if (status >= 200 && status <= 299 && status !== 202) {
			return {
				uri: responseURL || uri,
				originalUri: uri,
				data,
				status,
				headers,
				originalRequest: request,
				fromCache: !!headers['x-shaka-from-cache']
			};
		}

		let responseText: string | null = null;
		try {
			responseText = shaka.util.StringUtils.fromBytesAutoDetect(data);
		} catch {
			/* no-op */
		}

		const severity =
			status === 401 || status === 403
				? shaka.util.Error.Severity.CRITICAL
				: shaka.util.Error.Severity.RECOVERABLE;

		throw new shaka.util.Error(
			severity,
			shaka.util.Error.Category.NETWORK,
			shaka.util.Error.Code.BAD_HTTP_STATUS,
			uri,
			status,
			responseText,
			headers,
			requestType,
			responseURL || uri
		);
	}

	public static headersToGenericObject_(headers: Headers): Record<string, string> {
		const headersObj: Record<string, string> = {};
		headers.forEach((value, key) => {
			headersObj[key.trim()] = value;
		});
		return headersObj;
	}
}
