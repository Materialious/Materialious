import { Capacitor } from '@capacitor/core';
import type { DownloadFormatSelection, SabrFormat } from '@materialious/shared/download';

export type DownloadSelection = DownloadFormatSelection;

export type DownloadResult = {
	canceled?: boolean;
	path?: string;
	error?: string;
};

export type AvailableFormats = {
	title: string;
	formats: SabrFormat[];
};

export function isElectron(): boolean {
	return Capacitor.getPlatform() === 'electron';
}

export function buildDownloadURL(videoId: string, selection: DownloadSelection): string {
	const params = new URLSearchParams({ videoId, type: selection.type });

	if (selection.quality) params.set('quality', selection.quality);
	if (selection.format) params.set('format', selection.format);
	if (selection.codec) params.set('codec', selection.codec);

	return `/api/download?${params.toString()}`;
}

export async function getDownloadFormatsElectron(videoId: string): Promise<AvailableFormats> {
	return await window.electronAPI.getDownloadFormats(videoId);
}

export async function startElectronDownload(
	videoId: string,
	selection: DownloadSelection,
	onProgress?: (progress: number) => void
): Promise<DownloadResult> {
	if (onProgress) {
		window.electronAPI.onDownloadProgress((videoId_, progress) => {
			if (videoId_ === videoId) onProgress(progress);
		});
	}

	try {
		return await window.electronAPI.downloadVideo({ videoId, selection });
	} finally {
		window.electronAPI.removeDownloadProgressListener();
	}
}
