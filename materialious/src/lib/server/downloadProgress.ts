const downloadProgress = new Map<string, number>();

export function setDownloadProgress(downloadId: string, progress: number) {
	downloadProgress.set(downloadId, progress);
}

export function getDownloadProgress(downloadId: string): number {
	return downloadProgress.get(downloadId) ?? -1;
}

export function clearDownloadProgress(downloadId: string) {
	downloadProgress.delete(downloadId);
}
