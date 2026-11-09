import { tokenizeVTTCue, type VTTCue } from 'media-captions';

export interface TranscriptLine {
	startTime: number;
	endTime: number;
	text: string;
}

export function transcriptLines(cues: VTTCue[]): TranscriptLine[] {
	function text(nodes: ReturnType<typeof tokenizeVTTCue>): string {
		return nodes.map((node) => (node.type === 'text' ? node.data : text(node.children))).join('');
	}
	const entries = cues.map((cue) => ({
		startTime: cue.startTime,
		endTime: cue.endTime,
		parts: text(tokenizeVTTCue(cue))
			.split('\n')
			.map((part) => part.trim())
			.filter(Boolean)
	}));
	const rolling = (a: (typeof entries)[number], b: (typeof entries)[number]) =>
		b.startTime <= a.endTime &&
		a.parts.length > 0 &&
		b.parts.length > 0 &&
		(a.parts.length > 1 || b.parts.length > 1) &&
		a.parts[a.parts.length - 1] === b.parts[0];
	const result: TranscriptLine[] = [];
	let previous: TranscriptLine[] = [];
	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		const continues = i > 0 && rolling(entries[i - 1], entry);
		const isRolling = continues || (i + 1 < entries.length && rolling(entry, entries[i + 1]));
		const parts = isRolling ? entry.parts : [entry.parts.join('\n')];
		const current: TranscriptLine[] = [];
		for (const part of parts) {
			if (!part) continue;
			const existing = continues
				? previous.find((line) => line.text === part && !current.includes(line))
				: undefined;
			if (existing) {
				existing.endTime = Math.max(existing.endTime, entry.endTime);
				current.push(existing);
			} else {
				const line = { startTime: entry.startTime, endTime: entry.endTime, text: part };
				result.push(line);
				current.push(line);
			}
		}
		previous = current;
	}
	return result;
}
