import { WebPlugin, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

interface AndroidPictureInPicturePlugin {
	setPlaybackActive(options: { active: boolean }): Promise<void>;
	setAutoPipEnabled(options: { enabled: boolean }): Promise<void>;
	addListener(
		eventName: 'pictureInPictureModeChanged',
		listenerFunc: (event: { isInPictureInPictureMode: boolean }) => void
	): Promise<PluginListenerHandle>;
}

class AndroidPictureInPictureWeb extends WebPlugin implements AndroidPictureInPicturePlugin {
	async setPlaybackActive(): Promise<void> {}
	async setAutoPipEnabled(): Promise<void> {}
	async addListener(): Promise<PluginListenerHandle> {
		return { remove: async () => {} };
	}
}

export const AndroidPictureInPicture = registerPlugin<AndroidPictureInPicturePlugin>(
	'AndroidPictureInPicture',
	{ web: new AndroidPictureInPictureWeb() }
);
