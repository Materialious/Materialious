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
	if (selection.itag) params.set('itag', String(selection.itag));
	if (selection.format) params.set('format', selection.format);
	if (selection.codec) params.set('codec', selection.codec);
	if (selection.language) params.set('language', selection.language);

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

function filenameFromDisposition(disposition: string): string | undefined {
	const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(disposition)?.[1];
	if (encoded !== undefined) {
		try {
			return decodeURIComponent(encoded);
		} catch {
			// Fall through to the legacy filename parameter below.
		}
	}

	const quoted = /filename="([^"]*)"/i.exec(disposition)?.[1];
	if (quoted !== undefined) return quoted;
	return /filename=([^;]+)/i.exec(disposition)?.[1]?.trim();
}

async function pollDownloadProgress(
	downloadId: string,
	onProgress: (progress: number) => void
): Promise<() => Promise<void>> {
	let stopped = false;

	const poll = async () => {
		while (!stopped) {
			try {
				const resp = await fetch(`/api/download/progress?downloadId=${downloadId}`, {
					credentials: 'same-origin'
				});

				if (resp.ok) {
					const { progress } = (await resp.json()) as { progress: number };
					if (progress >= 0) onProgress(progress);
				}
			} catch {
				// Ignore transient polling errors; the download still proceeds.
			}

			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
	};

	const promise = poll();

	return async () => {
		stopped = true;
		await promise;
	};
}

export async function startWebDownload(
	videoId: string,
	selection: DownloadSelection,
	onProgress?: (progress: number) => void
): Promise<DownloadResult> {
	const downloadId = crypto.randomUUID();
	const url = `${buildDownloadURL(videoId, selection)}&downloadId=${downloadId}`;

	const stopProgress = onProgress ? await pollDownloadProgress(downloadId, onProgress) : undefined;

	try {
		const resp = await fetch(url, {
			credentials: 'same-origin'
		});

		if (!resp.ok) {
			const body = await resp.text().catch(() => '');
			let message = body || 'Download failed';
			try {
				const parsed = JSON.parse(body) as { message?: unknown };
				if (typeof parsed.message === 'string') message = parsed.message;
			} catch {
				// Not JSON; the raw body is already used as the message.
			}
			throw new Error(message);
		}

		const filename =
			filenameFromDisposition(resp.headers.get('Content-Disposition') ?? '') ?? 'download';

		const reader = resp.body?.getReader();
		if (!reader) throw new Error('Download stream unavailable');

		const chunks: BlobPart[] = [];

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				if (value) chunks.push(value);
			}
		} finally {
			reader.releaseLock();
		}

		const blob = new Blob(chunks);
		const objectUrl = URL.createObjectURL(blob);

		const a = document.createElement('a');
		a.href = objectUrl;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(objectUrl);

		onProgress?.(100);

		return {};
	} finally {
		await stopProgress?.();
	}
}
