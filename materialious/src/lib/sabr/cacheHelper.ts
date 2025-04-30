import type shaka from 'shaka-player/dist/shaka-player.ui';
import type { Misc } from 'youtubei.js';

import type { SabrStreamingContext } from './shakaHttpPlugin';
import { HttpFetchPlugin } from './shakaHttpPlugin';
import { createSegmentCacheKey, createSegmentCacheKeyFromContext } from './formatKeyUtils';
import type { Segment } from './sabrUmpParser';

/**
 * Caches a segment with its associated format
 * @param segment - The segment to cache
 * @param format - The format object
 */
export function cacheSegment(segment: Segment, format: Misc.Format) {
	const isInit = segment.mediaHeader.isInitSeg;
	const segmentKey = createSegmentCacheKey(segment.mediaHeader, isInit, format);

	if (isInit) {
		HttpFetchPlugin.cacheManager.setInitSegment(
			segmentKey,
			segment.data as Uint8Array<ArrayBuffer>
		);
	} else {
		HttpFetchPlugin.cacheManager.setSegment(segmentKey, segment.data as Uint8Array<ArrayBuffer>);
	}
}

/**
 * Retrieves a cached segment based on streaming context
 * @param decodedStreamingContext - The SABR streaming context
 * @param request - The original request.
 * @param requestType - The Shaka request type
 * @param uri - The request URI
 * @returns A Shaka response object or undefined if not found
 */
export function retrieveCachedSegment(
	decodedStreamingContext: SabrStreamingContext,
	request: shaka.extern.Request,
	requestType: shaka.net.NetworkingEngine.RequestType,
	uri: string
): shaka.extern.Response | null {
	if (!decodedStreamingContext.byteRange || !decodedStreamingContext.format) return null;

	const segmentKey = createSegmentCacheKeyFromContext({
		...decodedStreamingContext,
		isInit: decodedStreamingContext.isInit
	});

	let arrayBuffer: ArrayBuffer | undefined;

	arrayBuffer = (
		decodedStreamingContext.isInit
			? HttpFetchPlugin.cacheManager.getInitSegment(segmentKey)
			: HttpFetchPlugin.cacheManager.getSegment(segmentKey)
	)?.buffer;

	if (arrayBuffer) {
		if (decodedStreamingContext.isInit) {
			arrayBuffer = arrayBuffer.slice(
				decodedStreamingContext.byteRange.start,
				decodedStreamingContext.byteRange.end + 1
			);
		}

		const headers = HttpFetchPlugin.headersToGenericObject_(new Headers());
		headers['X-Streaming-Context'] = btoa(JSON.stringify(decodedStreamingContext));
		headers['content-type'] = decodedStreamingContext.format.mime_type.split(';')[0];
		headers['content-length'] = arrayBuffer.byteLength.toString();

		return HttpFetchPlugin.makeResponse(headers, arrayBuffer, 200, uri, uri, request, requestType);
	}

	return null;
}
