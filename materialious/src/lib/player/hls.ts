import shaka from 'shaka-player/dist/shaka-player.ui';

class HlsTransmuxer extends shaka.transmuxer.TsTransmuxer {
	private aacTransmuxer?: shaka.transmuxer.AacTransmuxer;

	public override transmux(
		data: BufferSource,
		stream: shaka.extern.Stream,
		reference: shaka.media.SegmentReference | null,
		duration: number,
		contentType: string
	): Promise<shaka.extern.TransmuxerOutput> {
		const bytes = shaka.util.BufferUtils.toUint8(data);
		// YouTube serves packed AAC in audio renditions named seg.ts. Shaka
		// 5.2's TS fallback scans the AAC payload for MP3 before checking ADTS,
		// so an MP3-like byte pattern in valid AAC can trigger error 3018.
		if (
			reference &&
			contentType === 'audio' &&
			stream.codecs.startsWith('mp4a.') &&
			!shaka.util.TsParser.probe(bytes)
		) {
			this.aacTransmuxer ??= new shaka.transmuxer.AacTransmuxer('audio/aac');
			// The stream is labelled TS, so Shaka cannot extract its packed-AAC
			// ID3 timestamp to calculate an offset. Package it on the manifest
			// timeline instead. AacTransmuxer uses endTime as its fallback clock.
			const id3 = shaka.metadata.Id3Utils.getID3Data(bytes);
			const aacReference: shaka.media.SegmentReference = Object.assign(Object.create(reference), {
				endTime: reference.getStartTime()
			});
			return this.aacTransmuxer.transmux(
				bytes.subarray(id3.length),
				stream,
				aacReference,
				duration
			);
		}

		return super.transmux(data, stream, reference, duration, contentType);
	}

	public override destroy(): void {
		this.aacTransmuxer?.destroy();
		this.aacTransmuxer = undefined;
		super.destroy();
	}
}

let registered = false;

export function registerHlsTransmuxer(): void {
	if (registered) return;
	const engine = shaka.transmuxer.TransmuxerEngine;
	for (const mimeType of ['video/mp2t', 'audio/mp2t']) {
		engine.registerTransmuxer(
			mimeType,
			() => new HlsTransmuxer(mimeType),
			engine.PluginPriority.APPLICATION
		);
	}
	registered = true;
}
