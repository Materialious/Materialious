import { Capacitor } from '@capacitor/core';
import { isOwnBackend } from '$lib/shared/index';
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

function isElectron(): boolean {
	return Capacitor.getPlatform() === 'electron';
}

export function isDownloadSupported(): boolean {
	return isElectron() || isOwnBackend() !== null;
}

export async function getDownloadFormats(videoId: string): Promise<AvailableFormats> {
	if (isElectron()) {
		return await window.electronAPI.getDownloadFormats(videoId);
	}

	const resp = await fetch('/api/download/formats', {
		method: 'POST',
		body: JSON.stringify({ videoId }),
		credentials: 'same-origin'
	});

	if (!resp.ok) {
		throw new Error('Failed to fetch download formats');
	}

	return await resp.json();
}

export function buildDownloadURL(videoId: string, selection: DownloadSelection): string {
	const params = new URLSearchParams({ videoId, type: selection.type });

	if (selection.quality) params.set('quality', selection.quality);
	if (selection.format) params.set('format', selection.format);
	if (selection.codec) params.set('codec', selection.codec);

	return `/api/download?${params.toString()}`;
}

export async function startDownload(
	videoId: string,
	selection: DownloadSelection,
	onProgress?: (progress: number) => void
): Promise<DownloadResult> {
	if (isElectron()) {
		return await startElectronDownload(videoId, selection, onProgress);
	}

	if (isOwnBackend()) {
		window.open(buildDownloadURL(videoId, selection), '_blank', 'noopener');
		return {};
	}

	throw new Error('Downloads are not supported in this environment');
}

async function startElectronDownload(
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
