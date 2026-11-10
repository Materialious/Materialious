import { getPublicEnv } from '#lib/env';
import { registerPlugin } from '@capacitor/core';
import { WebPlugin } from '@capacitor/core';

interface AndroidTV {
	isAndroidTv: () => Promise<{ value: boolean }>;
}

export class AndroidTvWeb extends WebPlugin implements AndroidTV {
	async isAndroidTv(): Promise<{ value: boolean }> {
		return { value: false };
	}
}

const nativeAndroidTv = registerPlugin<AndroidTV>('AndroidTv', {
	web: new AndroidTvWeb()
});

const androidTv: AndroidTV = {
	isAndroidTv: () =>
		getPublicEnv('ANDROID_TV_BUILD') === 'true'
			? Promise.resolve({ value: true })
			: nativeAndroidTv.isAndroidTv()
};

export default androidTv;
