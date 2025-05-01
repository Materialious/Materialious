import type { Misc } from 'youtubei.js/web';
import type { Protos } from 'googlevideo';
import type { SabrStreamingContext } from './shakaHttpPlugin';

/**
 * Creates a format key based on itag and xtags
 * @param itag - The itag value
 * @param xtags - The xtags value (optional)
 * @returns A string format key
 */
export function createKey(itag: number | undefined, xtags: string | undefined): string {
	return `${itag || ''}:${xtags || ''}`;
}

/**
 * Creates a format key from a Format object
 * @param format - The format object
 * @returns A string format key or undefined if format is undefined
 */
export function fromFormat(format: Misc.Format | undefined): string | undefined {
	if (!format) return undefined;
	return createKey(format.itag, format.xtags);
}

/**
 * Creates a format key from a MediaHeader object
 * @param mediaHeader - The MediaHeader object
 * @returns A string format key
 */
export function fromMediaHeader(mediaHeader: Protos.MediaHeader): string {
	return createKey(mediaHeader.itag, mediaHeader.xtags);
}

/**
 * Creates a format key from FormatInitializationMetadata
 * @param formatInitMetadata - The FormatInitializationMetadata object
 * @returns A string format key or undefined if formatId is undefined
 */
export function fromFormatInitializationMetadata(
	formatInitMetadata: Protos.FormatInitializationMetadata
): string {
	if (!formatInitMetadata.formatId) return '';
	return createKey(formatInitMetadata.formatId.itag, formatInitMetadata.formatId.xtags);
}

/**
 * Creates a segment cache key
 * @param mediaHeader - The MediaHeader object
 * @param isInit - Whether it's an initialization segment
 * @param format - Format object (needed for init segments)
 * @returns A string key for caching segments
 */
export function createSegmentCacheKey(
	mediaHeader: Protos.MediaHeader,
	isInit?: boolean,
	format?: Misc.Format
): string {
	if (isInit && format) {
		return `${mediaHeader.itag}:${mediaHeader.xtags || ''}:${format.content_length || ''}:${format.mime_type || ''}`;
	}
	/* @ts-ignore */
	return `${mediaHeader.startRange || '0'}-${mediaHeader.itag}-${mediaHeader.xtags || ''}`;
}

/**
 * Creates a segment cache key from a SabrStreamingContext object
 * @param context - The SabrStreamingContext object
 * @returns A string key for caching segments
 */
export function createSegmentCacheKeyFromContext(context: SabrStreamingContext): string {
	if (!context.byteRange || !context.format)
		throw new Error('Invalid context: byteRange or format is missing');

	const pseudoMediaHeader = {
		itag: context.format.itag,
		xtags: context.format.xtags || '',
		startDataRange: context.byteRange.start,
		isInitSeg: context.isInit
	};

	return createSegmentCacheKey(
		pseudoMediaHeader as any,
		!!context.isInit,
		context.isInit ? context.format : undefined
	);
}

export function getUniqueFormatId(format: Misc.Format) {
	if (format.has_video) return format.itag.toString();

	const uid_parts = [format.itag.toString()];

	if (format.audio_track) {
		uid_parts.push(format.audio_track.id);
	}

	if (format.is_drc) {
		uid_parts.push('drc');
	}

	return uid_parts.join('-');
}
