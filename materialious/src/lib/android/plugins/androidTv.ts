import { registerPlugin } from '@capacitor/core';

interface AndroidTV {
	isAndroidTv: () => Promise<boolean>;
}

const androidTv = registerPlugin<AndroidTV>('AndroidTv');

export default androidTv;
