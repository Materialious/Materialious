import { registerPlugin } from '@capacitor/core';
import { WebPlugin } from '@capacitor/core';

interface AndroidTV {
	isAndroidTv: () => Promise<boolean>;
}

export class AndroidTvWeb extends WebPlugin implements AndroidTV {
	async isAndroidTv(): Promise<boolean> {
		return false;
	}
}

const androidTv = registerPlugin<AndroidTV>('AndroidTv', {
	web: new AndroidTvWeb()
});

export default androidTv;
