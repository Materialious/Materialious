import { get } from 'svelte/store';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';
import { FileSharer } from '@capgo/capacitor-file-sharer';
import { Buffer } from 'buffer';
import { interfaceAndroidUseNativeShare } from '$lib/store';
import { addToast } from './components/Toast.svelte';
import { _ } from './i18n';

export async function shareURL(url: string) {
	if (
		Capacitor.getPlatform() === 'android' &&
		(await Share.canShare()).value &&
		get(interfaceAndroidUseNativeShare)
	) {
		await Share.share({ url: url });
	} else {
		await Clipboard.write({ string: url });
	}

	addToast({
		data: {
			text: get(_)('player.share.copiedSuccess')
		}
	});
}

export function blobToBase64(blob: Blob): Promise<string | ArrayBuffer | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

export async function downloadStringAsFile(content: string, filename: string) {
	const prefixedName = `${new Date().toDateString().replaceAll(' ', '')}-${filename}`;
	const blob = new Blob([content]);

	if (Capacitor.getPlatform() === 'android') {
		try {
			await FileSharer.save({
				filename: prefixedName,
				contentType: 'text/plain',
				base64Data: Buffer.from(content).toString('base64'),
				android: {
					saveDirectory: 'downloads',
				},
			});

			addToast({
				data: {
					text: get(_)('downloadedCompletedAndroid')
				}
			});
		} catch (errorMsg) {
			addToast({
				data: {
					text: errorMsg instanceof Error ? errorMsg.message : String(errorMsg)
				}
			});
		}
		return;
	}

	const url = URL.createObjectURL(blob);

	const a = document.createElement('a');
	a.href = url;
	a.download = prefixedName;

	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}