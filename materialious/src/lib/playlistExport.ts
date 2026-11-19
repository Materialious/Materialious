import Papa from 'papaparse';

interface PlaylistExportPage {
	videos: { videoId: string }[];
}

/** Read every page without the playback loader's deduplication or duration filters. */
export async function playlistToYouTubeCsv(
	loadPage: (page: number) => Promise<PlaylistExportPage>
): Promise<string> {
	const rows: string[][] = [];
	for (let page = 1; ; page++) {
		const { videos } = await loadPage(page);
		if (!videos.length) break;
		// The playlist APIs do not expose original addition timestamps.
		rows.push(...videos.map((video) => [video.videoId, '']));
	}
	return Papa.unparse({
		fields: ['Video ID', 'Playlist Video Creation Timestamp'],
		data: rows
	});
}

export function playlistExportFilename(title: string): string {
	const name =
		title
			.replace(/[^\p{L}\p{N} ._()-]/gu, '_')
			.trim()
			.slice(0, 150) || 'playlist';
	return `${name}-videos.csv`;
}
