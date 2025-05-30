import { GoogleVideo, Protos, concatenateChunks, type Part, PART } from 'googlevideo';
import shaka from 'shaka-player/dist/shaka-player.ui';

import { cacheSegment } from './cacheHelper';
import { fromFormat, fromMediaHeader } from './formatKeyUtils';
import { HttpFetchPlugin } from './shakaHttpPlugin';
import type { SabrStreamingContext } from './shakaHttpPlugin';

export interface Segment {
	headerId?: number;
	mediaHeader: Protos.MediaHeader;
	complete?: boolean;
	data: Uint8Array<ArrayBufferLike>;
}

export class SabrUmpParser {
	private partialPart?: Part;
	private formatInitMetadata: Protos.FormatInitializationMetadata[] = [];
	private playbackCookie?: Protos.PlaybackCookie;
	private targetHeaderId?: number;
	private targetSegment?: Segment;

	constructor(
		private response: Response,
		private decodedStreamingContext: SabrStreamingContext,
		private uri: string,
		private request: shaka.extern.Request,
		private requestType: shaka.net.NetworkingEngine.RequestType,
		private abortController: AbortController
	) {}

	async parse(): Promise<shaka.extern.Response> {
		const reader = this.response.clone().body!.getReader();

		while (!this.abortController.signal.aborted) {
			const { value, done } = await reader.read();

			if (done) {
				// If we got here, we read the whole stream but there was no data; it means we must follow this redirect.
				if (
					this.decodedStreamingContext.isSABR &&
					this.decodedStreamingContext.streamInfo?.redirect
				) {
					return this.createShakaResponse();
				}

				// We should never reach here, but if we do, it means we got nothing at all.
				throw this.createRecoverableError(
					'Empty response with no redirect information',
					this.decodedStreamingContext
				);
			}

			let chunk;

			if (this.partialPart) {
				chunk = this.partialPart.data;
				chunk.append(value);
			} else {
				chunk = new GoogleVideo.ChunkedDataBuffer([value]);
			}

			const result = await this.process(chunk);
			if (result) {
				if (this.shouldThrowServerError(result)) {
					throw this.createRecoverableError('Server streaming error', this.decodedStreamingContext);
				}
				return result;
			}
		}

		// Never happens. Here just in case.
		throw this.createRecoverableError(
			"Couldn't read any data from the stream",
			this.decodedStreamingContext
		);
	}

	private shouldThrowServerError(result: shaka.extern.Response): boolean {
		return (
			!result.data.byteLength &&
			(!!this.decodedStreamingContext.error ||
				this.decodedStreamingContext.streamInfo?.streamProtectionStatus?.status === 3)
		);
	}

	private createRecoverableError(message: string, info?: Record<string, any>) {
		return new shaka.util.Error(
			shaka.util.Error.Severity.RECOVERABLE,
			shaka.util.Error.Category.NETWORK,
			shaka.util.Error.Code.HTTP_ERROR,
			message,
			{ info }
		);
	}

	private process(
		value: GoogleVideo.ChunkedDataBuffer
	): Promise<shaka.extern.Response | undefined> {
		return new Promise((resolve) => {
			const ump = new GoogleVideo.UMP(value);

			this.partialPart = ump.parse((part: Part) => {
				const result = this.handlePart(part);
				if (result) {
					resolve(result);
				}
			});

			resolve(undefined);
		});
	}

	private handlePart(part: Part): shaka.extern.Response | undefined {
		switch (part.type) {
			case PART.FORMAT_INITIALIZATION_METADATA:
				this.handleFormatInitMetadata(part);
				break;
			case PART.NEXT_REQUEST_POLICY:
				this.handleNextRequestPolicy(part);
				break;
			case PART.MEDIA_HEADER:
				this.handleMediaHeader(part);
				break;
			case PART.MEDIA:
				this.handleMedia(part);
				break;
			case PART.MEDIA_END:
				return this.handleMediaEnd(part);
			case PART.SABR_ERROR:
				return this.handleSabrError(part);
			case PART.STREAM_PROTECTION_STATUS:
				return this.handleStreamProtectionStatus(part);
			case PART.SABR_REDIRECT:
				return this.handleSabrRedirect(part);
			default:
		}
	}

	private handleFormatInitMetadata(part: Part) {
		const formatInitMetadata = Protos.FormatInitializationMetadata.decode(part.data.chunks[0]);
		this.formatInitMetadata.push(formatInitMetadata);
	}

	private handleNextRequestPolicy(part: Part) {
		const nextRequestPolicy = Protos.NextRequestPolicy.decode(part.data.chunks[0]);
		if (this.decodedStreamingContext.format?.has_video) {
			this.playbackCookie = nextRequestPolicy.playbackCookie;
		}
	}

	private handleMediaHeader(part: Part) {
		const mediaHeader = Protos.MediaHeader.decode(part.data.chunks[0]);
		const formatKey = fromFormat(this.decodedStreamingContext.format);
		const segmentFormatKey = fromMediaHeader(mediaHeader);

		if (!this.decodedStreamingContext.isSABR || segmentFormatKey === formatKey) {
			if (!this.targetHeaderId) {
				this.targetHeaderId = mediaHeader.headerId;
				this.targetSegment = {
					headerId: mediaHeader.headerId,
					mediaHeader: mediaHeader,
					data: new Uint8Array()
				};
			}
		}
	}

	private handleMedia(part: Part) {
		const headerId = part.data.getUint8(0);
		const buffer = part.data.split(1).remainingBuffer;

		if (this.targetSegment && headerId === this.targetHeaderId) {
			this.targetSegment.data = concatenateChunks([this.targetSegment.data, ...buffer.chunks]);
		}
	}

	private handleMediaEnd(part: Part) {
		const headerId = part.data.getUint8(0);

		if (this.targetSegment && headerId === this.targetHeaderId) {
			if (this.decodedStreamingContext) {
				this.decodedStreamingContext.streamInfo = {
					...this.decodedStreamingContext.streamInfo,
					playbackCookie: this.playbackCookie,
					formatInitMetadata: this.formatInitMetadata,
					mediaHeader: this.targetSegment.mediaHeader.isInitSeg
						? undefined
						: this.targetSegment.mediaHeader
				};
			}

			let arrayBuffer: Uint8Array;

			// Why cache the init segment? Well, SABR responses are still a bit larger than usual - caching the init segment
			// helps reduce the delay when switching between different qualities or initializing a new stream.
			if (
				this.decodedStreamingContext.isInit &&
				this.decodedStreamingContext.format &&
				this.decodedStreamingContext.byteRange
			) {
				cacheSegment(this.targetSegment, this.decodedStreamingContext.format);
				arrayBuffer = this.targetSegment.data.slice(
					this.decodedStreamingContext.byteRange.start,
					this.decodedStreamingContext.byteRange.end + 1
				);
			} else {
				arrayBuffer = this.targetSegment.data;
			}

			// We got what we wanted; close the stream and abort the request.
			this.abortController.abort();
			return this.createShakaResponse(arrayBuffer);
		}
	}

	private handleSabrError(part: Part) {
		const sabrError = Protos.SabrError.decode(part.data.chunks[0]);

		if (this.decodedStreamingContext) {
			this.decodedStreamingContext.error = { sabrError };
		}

		this.abortController.abort();
		return this.createShakaResponse();
	}

	private handleStreamProtectionStatus(part: Part) {
		const streamProtectionStatus = Protos.StreamProtectionStatus.decode(part.data.chunks[0]);

		if (this.decodedStreamingContext) {
			this.decodedStreamingContext.streamInfo = {
				...this.decodedStreamingContext.streamInfo,
				streamProtectionStatus
			};
		}

		if (streamProtectionStatus.status === 3) {
			this.abortController.abort();
			return this.createShakaResponse();
		}
	}

	private handleSabrRedirect(part: Part) {
		const redirect = Protos.SabrRedirect.decode(part.data.chunks[0]);

		if (this.decodedStreamingContext) {
			this.decodedStreamingContext.streamInfo = {
				...this.decodedStreamingContext.streamInfo,
				redirect
			};
		}

		// With pure UMP, redirects should be followed immediately.
		if (this.decodedStreamingContext.isUMP && !this.decodedStreamingContext.isSABR) {
			this.abortController.abort();
			return this.createShakaResponse();
		}
	}

	private createShakaResponse(body?: Uint8Array): shaka.extern.Response {
		return HttpFetchPlugin.makeResponse(
			this.createContextHeaders(),
			body || new ArrayBuffer(0),
			this.response.status,
			this.uri,
			this.response.url,
			this.request,
			this.requestType
		);
	}

	private createContextHeaders(): Record<string, any> {
		const headers = HttpFetchPlugin.headersToGenericObject_(this.response.headers);
		if (this.decodedStreamingContext) {
			headers['X-Streaming-Context'] = btoa(JSON.stringify(this.decodedStreamingContext));
		}
		return headers;
	}
}
