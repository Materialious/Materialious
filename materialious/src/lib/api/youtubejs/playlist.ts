import { extractNumber } from '$lib/numbers';
import { YT, YTNodes } from 'youtubei.js';
import { getInnertube } from '.';
import type { PlaylistPage, PlaylistPageVideo } from '../model';

async function fetchPlaylistWithContinuation(
	playlist: YT.Playlist,
	playlistId: string
): Promise<PlaylistPage> {
	const videos: PlaylistPageVideo[] = [];

	playlist.videos.forEach((video) => {
		if (video.is(YTNodes.PlaylistVideo)) {
			const videoIndex = video.index.text ?? '0';
			videos.push({
				type: 'video',
				author: video.author.name,
				authorId: video.author.id,
				index: extractNumber(videoIndex),
				indexId: videoIndex,
				viewCount: 0,
				title: video.title.text ?? '',
				videoId: video.id ?? '',
				lengthSeconds: video.duration.seconds,
				videoThumbnails: video.thumbnails
			});
		}
	});

	const playlistPage: PlaylistPage = {
		type: 'playlist',
		title: playlist.info.title ?? '',
		description: playlist.info.description ?? '',
		descriptionHtml: playlist.info.description ?? '',
		viewCount: extractNumber(playlist.info.views ?? '0'),
		updated: 0,
		isListed: true,
		videos: videos,
		playlistId,
		videoCount: playlist.videos.length,
		author: playlist.info.author.name,
		authorId: playlist.info.author.id,
		authorVerified: true,
		playlistThumbnail: playlist.info.thumbnails[0].url ?? ''
	};

	if (playlist) {
		playlistPage.getContinuation = async () => {
			const continuation = await playlist.getContinuation();
			return fetchPlaylistWithContinuation(continuation, playlistId);
		};
	}

	return playlistPage;
}

export async function getPlaylistYTjs(playlistId: string): Promise<PlaylistPage> {
	const innertube = await getInnertube();
	const playlist = await innertube.getPlaylist(playlistId);

	return fetchPlaylistWithContinuation(playlist, playlistId);
}
