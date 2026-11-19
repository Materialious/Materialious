import Papa from 'papaparse';
import z from 'zod';

export interface ImportedPlaylist {
	title: string;
	videoIds: string[];
	source: string;
}

const videoId = z
	.string()
	.trim()
	.regex(/^[\w-]{11}$/);
const freeTubePlaylist = z.object({
	playlistName: z.string().trim().min(1),
	videos: z.array(z.object({ videoId }))
});
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z]/g, '');

/** Parse before writing anything. Preserve order and duplicate occurrences. */
export function parsePlaylistFile(contents: string, filename: string): ImportedPlaylist[] {
	const text = contents.trim();
	if (!text) throw new Error(`${filename}: Empty file`);
	return text.startsWith('{') || text.startsWith('[')
		? parseFreeTubePlaylists(text, filename)
		: [parsePlaylistCsv(text, filename)];
}

function parseJsonRecords(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return text
			.split(/\r?\n/)
			.filter((line) => line.trim())
			.map((line) => JSON.parse(line));
	}
}

function parseFreeTubePlaylists(text: string, filename: string): ImportedPlaylist[] {
	let records: unknown;
	try {
		records = parseJsonRecords(text);
	} catch {
		throw new Error(`${filename}: Invalid FreeTube JSON`);
	}

	const result = z
		.array(freeTubePlaylist)
		.min(1)
		.safeParse(Array.isArray(records) ? records : [records]);
	if (!result.success)
		throw new Error(
			`${filename}: Invalid FreeTube playlist (${result.error.issues[0]?.path.join('.')})`
		);
	return result.data.map((playlist) => ({
		title: playlist.playlistName,
		videoIds: playlist.videos.map((video) => video.videoId),
		source: filename
	}));
}

function parsePlaylistCsv(text: string, filename: string): ImportedPlaylist {
	const csv = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' });
	const headers = csv.data.map((row) => row.map(normalize));
	if (csv.errors.length) throw new Error(`${filename}: Invalid CSV (${csv.errors[0].message})`);
	// Some older exports have a metadata section before the membership header.
	const headerIndex = headers.findIndex(
		(row) =>
			row.includes('videoid') &&
			(row.includes('timeadded') || row.includes('playlistvideocreationtimestamp'))
	);
	if (headerIndex < 0) throw new Error(`${filename}: No playlist video ID column found`);
	const column = headers[headerIndex].indexOf('videoid');
	let title = filename
		.replace(/\.csv$/i, '')
		.replace(/-videos$/i, '')
		.trim();
	if (headerIndex > 1) {
		const titleColumn = headers[0].findIndex((cell) => ['title', 'playlisttitle'].includes(cell));
		if (titleColumn >= 0) title = csv.data[1][titleColumn]?.trim() || title;
	}
	if (!title) throw new Error(`${filename}: Missing playlist title`);
	const videoIds = csv.data.slice(headerIndex + 1).map((row, index) => {
		const result = videoId.safeParse(row[column]);
		if (!result.success)
			throw new Error(`${filename}: Invalid video ID at record ${headerIndex + index + 2}`);
		return result.data;
	});
	return { title, videoIds, source: filename };
}

export interface PlaylistImportResult {
	title: string;
	source: string;
	playlistId?: string;
	imported: number;
	total: number;
	status: 'pending' | 'stopped' | 'complete';
	failures: { videoId?: string; position?: number; message: string }[];
}

interface ImportOperations {
	create: (title: string) => Promise<string>;
	add: (playlistId: string, videoId: string) => Promise<void>;
	/** Check the selected account and destination before every write. */
	checkAccount: () => void;
	onProgress?: (completed: number, total: number) => void;
	signal: AbortSignal;
}

export async function importPlaylists(
	playlists: ImportedPlaylist[],
	operations: ImportOperations
): Promise<PlaylistImportResult[]> {
	const results: PlaylistImportResult[] = playlists.map((playlist) => ({
		title: playlist.title,
		source: playlist.source,
		imported: 0,
		total: playlist.videoIds.length,
		status: 'pending',
		failures: []
	}));
	const total = playlists.reduce((count, playlist) => count + playlist.videoIds.length, 0);
	let completed = 0;
	for (const [index, playlist] of playlists.entries()) {
		if (operations.signal.aborted) break;
		const result = results[index];
		result.status = 'stopped';
		try {
			operations.checkAccount();
			result.playlistId = await operations.create(playlist.title);
			for (const [position, id] of playlist.videoIds.entries()) {
				if (operations.signal.aborted) return results;
				operations.checkAccount();
				try {
					await operations.add(result.playlistId, id);
					result.imported++;
				} catch (error) {
					result.failures.push({ videoId: id, position, message: String(error) });
					// Only a definite missing-video response is safe to skip. Other failures
					// can be quota/auth errors or writes with an unknown network outcome.
					if (!(
						error &&
						typeof error === 'object' &&
						'response' in error &&
						error.response instanceof Response &&
						error.response.status === 404
					))
						return results;
				}
				operations.onProgress?.(++completed, total);
			}
			result.status = 'complete';
		} catch (error) {
			result.failures.push({ message: String(error) });
			return results;
		}
	}
	return results;
}
