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

const androidTv = registerPlugin<AndroidTV>('AndroidTv', {
	web: new AndroidTvWeb()
});

export default androidTv;
