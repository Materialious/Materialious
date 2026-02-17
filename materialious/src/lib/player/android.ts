import type { VideoPlay } from '$lib/api/model';
import { playerAndroidLockOrientation, playerAndroidPauseOnNetworkChange } from '$lib/store';
import { setStatusBarColor } from '$lib/theme';
import { get } from 'svelte/store';
import { Capacitor, SystemBars, SystemBarsStyle, SystemBarType } from '@capacitor/core';
import { ScreenOrientation, type ScreenOrientationResult } from '@capacitor/screen-orientation';
import { Network, type ConnectionStatus } from '@capacitor/network';

export class AndroidPlayer {
	video: VideoPlay;
	originalOrigination: ScreenOrientationResult | undefined;
	initialNetworkStatus: ConnectionStatus | undefined;
	playerElement: HTMLMediaElement | undefined;

	constructor(video: VideoPlay, playerElement: HTMLMediaElement | undefined) {
		this.video = video;
		this.playerElement = playerElement;

		if (Capacitor.getPlatform() !== 'android') return;

		ScreenOrientation.orientation().then((originalOrigination) => {
			this.originalOrigination = originalOrigination;
		});
		Network.getStatus().then((initialNetworkStatus) => {
			this.initialNetworkStatus = initialNetworkStatus;
		});

		document.addEventListener('fullscreenchange', this.onFullscreenChange);

		Network.addListener('networkStatusChange', (networkStatus) => {
			if (
				this.initialNetworkStatus?.connectionType !== networkStatus.connectionType &&
				get(playerAndroidPauseOnNetworkChange)
			) {
				this.playerElement?.pause();
			}
		});
	}

	async destroy() {
		if (Capacitor.getPlatform() !== 'android') return;

		document.removeEventListener('fullscreenchange', this.onFullscreenChange);

		if (this.originalOrigination) {
			await ScreenOrientation.lock({
				orientation: this.originalOrigination.type
			});
		}

		await Network.removeAllListeners();
	}

	async onFullscreenChange() {
		if (Capacitor.getPlatform() !== 'android') return;

		const videoFormats = this.video.adaptiveFormats.filter((format) =>
			format.type.startsWith('video/')
		);

		const isFullScreen = !!document.fullscreenElement;

		if (isFullScreen) {
			// Ensure bar color is black while in fullscreen
			await SystemBars.setStyle({ style: SystemBarsStyle.Light });
			await SystemBars.hide({
				bar: SystemBarType.NavigationBar
			});
			await SystemBars.hide({
				bar: SystemBarType.StatusBar
			});
		} else {
			await setStatusBarColor();
		}

		if (!get(playerAndroidLockOrientation)) return;

		if (isFullScreen && videoFormats[0].resolution) {
			const widthHeight = videoFormats[0].resolution.split('x');

			if (widthHeight.length !== 2) return;

			if (Number(widthHeight[0]) > Number(widthHeight[1])) {
				await ScreenOrientation.lock({ orientation: 'landscape' });
			} else {
				await ScreenOrientation.lock({ orientation: 'portrait' });
			}
		} else {
			if (this.originalOrigination)
				await ScreenOrientation.lock({
					orientation: this.originalOrigination.type
				});
		}
	}
}
